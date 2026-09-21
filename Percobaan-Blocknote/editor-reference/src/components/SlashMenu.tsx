import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { databases, APPWRITE_CONFIG, ID } from "../lib/appwrite";
import { Query } from "appwrite";

interface SlashMenuProps {
    position: { x: number; y: number };
    initialScenePosition?: { x: number; y: number };
    excalidrawAPI?: any;
    mode?: "slash" | "mention";
    mentionQuery?: string;
    onNoteCreated: (id: string, title: string) => void;
    onNoteSelected?: (id: string, title: string) => void;
    onClose: () => void;
}

export interface SlashMenuRef {
    handleKeyDown: (e: KeyboardEvent) => void;
}

interface NoteItem {
    id: string;
    title: string;
    isCreateNew?: boolean;
    onSelect: () => void;
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(({ position, initialScenePosition, excalidrawAPI, mode = "slash", mentionQuery, onNoteCreated, onNoteSelected, onClose }, ref) => {
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<NoteItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<any>(null);

    useEffect(() => {
        if (mode === "slash") {
            inputRef.current?.focus();
        }
    }, [mode]);

    useEffect(() => {
        if (mode === "mention" && mentionQuery !== undefined) {
            setQuery(mentionQuery);
        }
    }, [mentionQuery, mode]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                // Mention mode: limit 50, otherwise limit 10
                const limit = mode === "mention" ? 50 : 10;
                const queries = [
                    Query.limit(limit),
                    Query.notEqual("status", "trashed")
                ];
                
                if (query.trim()) {
                    queries.push(Query.search("title", query));
                } else {
                    queries.push(Query.orderDesc("$createdAt"));
                }

                const response = await databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    queries
                );

                const exactMatch = response.documents.find(
                    d => d.title.toLowerCase() === query.trim().toLowerCase()
                );

                const noteItems: NoteItem[] = response.documents.map(doc => ({
                    id: doc.$id,
                    title: doc.title,
                    onSelect: () => insertNoteBox(doc.$id, doc.title, false),
                }));

                // Client-side case-insensitive sorting A-Z for mention mode
                if (mode === "mention") {
                    noteItems.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
                }

                if (mode === "slash") {
                    if (query.trim() !== "" && !exactMatch) {
                        noteItems.unshift({
                            id: "__create__",
                            title: `Buat note baru: ${query}`,
                            isCreateNew: true,
                            onSelect: () => createAndInsertNote(query),
                        });
                    }
                }

                setItems(noteItems);
                
                // For mention mode, selectedIndex 0 is the "Buat note baru" sticky button if list is empty,
                // or if list is not empty, it's the first note in the list. Wait, keyboard navigation needs to handle sticky button.
                setSelectedIndex(0);
            } catch (e) {
                console.error("Failed to search notes:", e);
                setItems([]);
            }
        }, 250);
    }, [query, mode]);

    // For mention mode, total items = items.length + 1 (the sticky create button)
    const exactMatchExists = items.some(item => item.title.toLowerCase() === query.trim().toLowerCase());
    const showStickyCreate = mode === "mention" && (!exactMatchExists || query.trim() === "");
    const totalItems = mode === "mention" ? (showStickyCreate ? items.length + 1 : items.length) : items.length;

    useEffect(() => {
        if (mode === "mention") {
            // Scroll logic is a bit different since index 0 might be sticky
            if (showStickyCreate && selectedIndex === 0) return; // Sticky button is always visible
            
            const listIndex = showStickyCreate ? selectedIndex - 1 : selectedIndex;
            if (listIndex >= 0) {
                const selectedEl = listRef.current?.children[listIndex] as HTMLElement;
                selectedEl?.scrollIntoView({ block: "nearest" });
            }
        } else {
            const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement;
            selectedEl?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex, showStickyCreate, mode]);

    const insertNoteBox = (noteId: string, title: string, isNew: boolean) => {
        if (mode === "mention") {
            if (isNew) {
                onNoteCreated(noteId, title);
            }
            if (onNoteSelected) {
                onNoteSelected(noteId, title);
            }
            onClose();
            return;
        }

        const newId = `box-${Date.now()}`;
        const newEmbeddable = {
            type: "embeddable" as const,
            version: 1,
            versionNonce: Date.now(),
            isDeleted: false,
            id: newId,
            fillStyle: "hachure" as const,
            strokeWidth: 1,
            strokeStyle: "solid" as const,
            roughness: 1,
            opacity: 100,
            angle: 0,
            x: initialScenePosition?.x ?? 0,
            y: initialScenePosition?.y ?? 0,
            strokeColor: "#000000",
            backgroundColor: "transparent",
            width: 220,
            height: 90,
            seed: Date.now(),
            groupIds: [],
            frameId: null,
            roundness: null,
            boundElements: [],
            updated: 1,
            link: `note://${noteId}`,
            locked: false,
        };
        excalidrawAPI?.updateScene({
            elements: [...excalidrawAPI.getSceneElements(), newEmbeddable],
        });
        if (isNew) {
            onNoteCreated(noteId, title);
        }
        console.log("[DIAG-S] Menu ditutup karena: insertNoteBox dipanggil (note dipilih).");
        onClose();
    };

    const createAndInsertNote = async (title: string) => {
        const finalTitle = title.trim() || "(Tanpa judul)";
        try {
            const newDoc = await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                ID.unique(),
                {
                    title: finalTitle,
                    content: "",
                    status: "draft",
                }
            );
            onNoteCreated(newDoc.$id, finalTitle);
            insertNoteBox(newDoc.$id, finalTitle, true);
        } catch (e) {
            console.error("Gagal membuat dokumen Appwrite untuk kotak baru:", e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
        e.stopPropagation();
        if ('nativeEvent' in e) {
            e.nativeEvent.stopImmediatePropagation();
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (mode === "mention") {
                if (showStickyCreate && selectedIndex === 0) {
                    createAndInsertNote(query);
                } else {
                    const listIndex = showStickyCreate ? selectedIndex - 1 : selectedIndex;
                    const item = items[listIndex];
                    if (item) item.onSelect();
                }
            } else {
                const item = items[selectedIndex];
                if (item) item.onSelect();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            console.log("[DIAG-S] Menu ditutup karena: Escape ditekan.");
            onClose();
        }
    };

    useImperativeHandle(ref, () => ({
        handleKeyDown: (e: KeyboardEvent) => {
            handleKeyDown(e);
        }
    }));

    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".slash-menu")) {
            console.log("[DIAG-S] Menu ditutup karena: klik di luar area menu (handleClickOutside). activeElement:", document.activeElement?.tagName, document.activeElement?.className);
            onClose();
        }
    };

    useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div
            className="slash-menu"
            style={{
                position: "fixed",
                left: position.x,
                // Adjust position dynamically if near bottom screen edge (Task 6)
                top: position.y > window.innerHeight - 360 ? position.y - 360 - 40 : position.y,
                zIndex: 9999,
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                width: 280,
                maxHeight: 360,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => {
                if (mode === "mention") {
                    console.log("[DIAG-S] Mousedown di menu (mode mention). Mencegah hilangnya fokus textarea.");
                    e.preventDefault();
                }
            }}
            onWheel={(e) => {
                e.stopPropagation();
            }}
        >
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={mode === "mention" ? "Cari note..." : "Cari atau buat note..."}
                    readOnly={mode === "mention"}
                    onMouseDown={() => {
                        console.log("[DIAG-S] Mousedown di kotak cari.");
                        // if mode is mention, outer div already prevents default.
                    }}
                    style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        fontSize: "0.95rem",
                        background: "transparent",
                        color: mode === "mention" ? "#64748b" : "inherit"
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
            {mode === "mention" && showStickyCreate && (
                <div
                    onMouseDown={(e) => {
                        e.preventDefault();
                        createAndInsertNote(query);
                    }}
                    style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        background: selectedIndex === 0 ? "#f1f5f9" : "white",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: "0.9rem",
                        color: "#3b82f6",
                        fontWeight: 600,
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                    }}
                >
                    + Buat note baru{query.trim() ? `: ${query}` : ''}
                </div>
            )}
            <div ref={listRef} style={{ overflow: "auto", flex: 1, maxHeight: mode === "mention" ? "260px" : "auto" }}>
                {mode === "slash" && items.length === 0 && query.trim() !== "" && (
                    <div style={{ padding: "12px", color: "#64748b", fontSize: "0.875rem", textAlign: "center" }}>
                        Tidak ada hasil
                    </div>
                )}
                {mode === "slash" && items.length === 0 && query.trim() === "" && (
                    <div style={{ padding: "12px", color: "#64748b", fontSize: "0.875rem", textAlign: "center" }}>
                        Ketik untuk mencari note...
                    </div>
                )}
                {items.map((item, idx) => {
                    const activeIndex = mode === "mention" ? (showStickyCreate ? idx + 1 : idx) : idx;
                    return (
                        <div
                            key={item.id}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevents focus loss from textarea
                                item.onSelect();
                            }}
                            style={{
                                padding: "10px 12px",
                                cursor: "pointer",
                                background: activeIndex === selectedIndex ? "#f1f5f9" : "transparent",
                                borderBottom: "1px solid #f8fafc",
                                fontSize: "0.9rem",
                                color: item.isCreateNew ? "#3b82f6" : "#0f172a",
                                fontWeight: item.isCreateNew ? 600 : 400,
                            }}
                        >
                            {item.isCreateNew ? (
                                <span>+ {item.title}</span>
                            ) : (
                                <span>📝 {item.title}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
