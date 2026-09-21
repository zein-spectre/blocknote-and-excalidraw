import { useState, useEffect, useRef } from "react";
import { databases, APPWRITE_CONFIG, ID } from "../lib/appwrite";
import { Query } from "appwrite";

interface SlashMenuProps {
    position: { x: number; y: number };
    initialScenePosition: { x: number; y: number };
    excalidrawAPI: any;
    onNoteCreated: (id: string, title: string) => void;
    onClose: () => void;
}

interface NoteItem {
    id: string;
    title: string;
    isCreateNew?: boolean;
    onSelect: () => void;
}

export function SlashMenu({ position, initialScenePosition, excalidrawAPI, onNoteCreated, onClose }: SlashMenuProps) {
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<NoteItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<any>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const queries = [Query.limit(10), Query.orderDesc("$createdAt")];
                if (query.trim()) {
                    queries.push(Query.search("title", query));
                }

                const response = await databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    queries
                );

                const exactMatch = response.documents.find(
                    d => d.title.toLowerCase() === query.toLowerCase()
                );

                const noteItems: NoteItem[] = response.documents.map(doc => ({
                    id: doc.$id,
                    title: doc.title,
                    onSelect: () => insertNoteBox(doc.$id, doc.title, false),
                }));

                if (query.trim() !== "" && !exactMatch) {
                    noteItems.unshift({
                        id: "__create__",
                        title: `Buat note baru: ${query}`,
                        isCreateNew: true,
                        onSelect: () => createAndInsertNote(query),
                    });
                }

                setItems(noteItems);
                setSelectedIndex(0);
            } catch (e) {
                console.error("Failed to search notes:", e);
                setItems([]);
            }
        }, 250);
    }, [query]);

    useEffect(() => {
        const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement;
        selectedEl?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const insertNoteBox = (noteId: string, title: string, isNew: boolean) => {
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
            x: initialScenePosition.x,
            y: initialScenePosition.y,
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
        excalidrawAPI.updateScene({
            elements: [...excalidrawAPI.getSceneElements(), newEmbeddable],
        });
        if (isNew) {
            onNoteCreated(noteId, title);
        }
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const item = items[selectedIndex];
            if (item) item.onSelect();
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    };

    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".slash-menu")) {
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
                top: position.y,
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
        >
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Cari atau buat note..."
                    style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        fontSize: "0.95rem",
                        background: "transparent",
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div ref={listRef} style={{ overflow: "auto", flex: 1 }}>
                {items.length === 0 && query.trim() !== "" && (
                    <div style={{ padding: "12px", color: "#64748b", fontSize: "0.875rem", textAlign: "center" }}>
                        Tidak ada hasil
                    </div>
                )}
                {items.length === 0 && query.trim() === "" && (
                    <div style={{ padding: "12px", color: "#64748b", fontSize: "0.875rem", textAlign: "center" }}>
                        Ketik untuk mencari note...
                    </div>
                )}
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        onClick={() => item.onSelect()}
                        style={{
                            padding: "10px 12px",
                            cursor: "pointer",
                            background: idx === selectedIndex ? "#f1f5f9" : "transparent",
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
                ))}
            </div>
        </div>
    );
}
