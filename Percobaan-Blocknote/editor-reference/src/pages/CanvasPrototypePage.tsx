import { useState, useRef, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Editor } from "../components/Editor";
import { SlashMenu } from "../components/SlashMenu";
import { databases, APPWRITE_CONFIG, ID } from "../lib/appwrite";
import { Query } from "appwrite";

// Text box embeddable styles
const TEXT_BOX_BG = "#f0fdf4";
const TEXT_BOX_BORDER = "#86efac";

export function CanvasPrototypePage() {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    // State for Appwrite Note
    const [appwriteNoteId, setAppwriteNoteId] = useState<string | null>(null);
    const [appwriteNoteData, setAppwriteNoteData] = useState<{ title: string; content: string } | null>(null);
    const [appwriteLoading, setAppwriteLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<string>("");

    // State for Canvas Scene
    const [canvasLoading, setCanvasLoading] = useState(true);
    const [canvasId, setCanvasId] = useState<string | null>(null);
    const [canvasInitialElements, setCanvasInitialElements] = useState<any[]>([]);
    const [canvasSaveStatus, setCanvasSaveStatus] = useState<string>("");

    const latestDataRef = useRef<{ title: string; content: string }>({ title: "", content: "" });
    const debounceSaveRef = useRef<any>(null);
    const lastExcalidrawSelectedIdRef = useRef<string | null>(null);

    const debounceCanvasSaveRef = useRef<any>(null);
    const lastSavedSceneRef = useRef<string>("");

    // Data disimpan di memori
    const [notesData, setNotesData] = useState<Record<string, { title: string; content: string }>>({
        "embed-1": { title: "Welcome Note", content: "" }
    });

    // Mapping Appwrite Note ID -> Title
    const [appwriteTitles, setAppwriteTitles] = useState<Record<string, string>>({});

    // Slash menu state
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
    const lastPointerSceneRef = useRef({ x: 0, y: 0 });
    const lastPointerScreenRef = useRef({ x: 400, y: 200 });
    const slashMenuScenePosRef = useRef({ x: 400, y: 100 });

    // Note mention menu state
    const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
    const [mentionMenuTextarea, setMentionMenuTextarea] = useState<HTMLTextAreaElement | null>(null);
    const [mentionMenuPosition, setMentionMenuPosition] = useState({ x: 0, y: 0 });

    // Text box editor state (key = element id, value = JSON string of blocks)
    const [textBoxContent, setTextBoxContent] = useState<Record<string, string>>({});
    const textBoxDebounceRef = useRef<Record<string, any>>({});

    // Refs for tracking text element editing (customData.mentions)
    const textareaListenerRef = useRef<any>(null);
    const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const editingTextElementIdRef = useRef<string | null>(null);
    const mentionEditsRef = useRef<{ elementId: string; mentions: { noteId: string; title: string }[] }[]>([]);
    // pendingMentionUpdateRef was removed since we do it instantly now
    const noteTitlesForMentionRef = useRef<Record<string, string>>({});
    
    const [mentionQuery, setMentionQuery] = useState("");
    const mentionStartIndexRef = useRef(-1);
    const mentionMenuOpenRef = useRef(false);
    const slashMenuRef = useRef<any>(null);
    
    const pointerDownScreenPosRef = useRef<{ x: number, y: number } | null>(null);
    const pointerDownMentionRef = useRef<any>(null);

    useEffect(() => {
        mentionMenuOpenRef.current = mentionMenuOpen;
    }, [mentionMenuOpen]);

    // Keep noteTitlesForMentionRef in sync with appwriteTitles
    useEffect(() => {
        noteTitlesForMentionRef.current = appwriteTitles;
    }, [appwriteTitles]);

    const setupMentionListener = () => {
        const textarea = document.querySelector<HTMLTextAreaElement>(".excalidraw-wysiwyg");
        if (!textarea) {
            if (mentionMenuOpenRef.current) {
                setMentionMenuOpen(false);
            }
            return;
        }

        if (activeTextareaRef.current === textarea) return;

        if (textareaListenerRef.current && activeTextareaRef.current) {
            const old = textareaListenerRef.current;
            activeTextareaRef.current.removeEventListener("keydown", old.keydown, true);
            activeTextareaRef.current.removeEventListener("input", old.input);
        }

        activeTextareaRef.current = textarea;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!mentionMenuOpenRef.current) {
                if (e.key === "@") {
                    const selStart = (e.target as HTMLTextAreaElement).selectionStart;
                    const val = (e.target as HTMLTextAreaElement).value;
                    if (selStart > 0 && !/\s/.test(val[selStart - 1])) return;

                    const rect = textarea.getBoundingClientRect();
                    setMentionMenuPosition({ x: rect.left, y: rect.bottom + 5 });
                    setMentionMenuTextarea(textarea);
                    setMentionMenuOpen(true);
                    
                    mentionStartIndexRef.current = selStart;
                    setMentionQuery("");

                    console.log("[DIAG-M] Menu dibuka. document.activeElement:", document.activeElement?.tagName, document.activeElement?.className, "Textarea ada:", !!document.querySelector(".excalidraw-wysiwyg"));
                }
                return;
            }

            if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (slashMenuRef.current) {
                    slashMenuRef.current.handleKeyDown(e);
                }
            }
        };

        const handleInput = () => {
            if (!mentionMenuOpenRef.current) return;
            const selStart = textarea.selectionStart;
            
            if (selStart <= mentionStartIndexRef.current) {
                setMentionMenuOpen(false);
                return;
            }
            
            const val = textarea.value;
            if (val[mentionStartIndexRef.current] !== "@") {
                setMentionMenuOpen(false);
                return;
            }

            const queryText = val.slice(mentionStartIndexRef.current + 1, selStart);
            setMentionQuery(queryText);
        };

        textarea.addEventListener("keydown", handleKeyDown, true);
        textarea.addEventListener("input", handleInput);
        
        textareaListenerRef.current = { keydown: handleKeyDown, input: handleInput };
    };
    
    const getMentionClicked = (el: any, clickX: number, clickY: number) => {
        if (!el.customData?.mentions?.length) return null;
        
        // 1. Diagnosis log for bound text
        if (el.containerId) {
            console.log("[DIAG-W] === Klik di Bentuk dengan Teks Terikat ===");
            console.log("[DIAG-W] customData.mentions:", el.customData.mentions);
            console.log("[DIAG-W] el.text:", JSON.stringify(el.text));
            console.log("[DIAG-W] el.originalText:", JSON.stringify(el.originalText));
        }

        const originalText = el.originalText || el.text;
        const wrappedText = el.text;
        
        // 2. Build mapping array: map[wrappedIndex] = originalIndex
        const map: number[] = new Array(wrappedText.length).fill(-1);
        let o = 0;
        let w = 0;
        let mappingValid = true;
        
        while (w < wrappedText.length && o < originalText.length) {
            if (wrappedText[w] === originalText[o]) {
                map[w] = o;
                w++;
                o++;
            } else {
                if (wrappedText[w] === '\n') {
                    if (originalText[o] === ' ') {
                        map[w] = o;
                        w++;
                        o++;
                    } else {
                        map[w] = o;
                        w++;
                    }
                } else if (originalText[o] === ' ' || originalText[o] === '\r' || originalText[o] === '\n') {
                    o++;
                } else {
                    mappingValid = false;
                    break;
                }
            }
        }
        while (w < wrappedText.length && wrappedText[w] === '\n') {
            map[w] = o;
            w++;
        }

        if (!mappingValid && el.containerId) {
            console.log("[DIAG-W] Pemetaan karakter tidak bisa dibuat pasti untuk teks ini.");
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        
        const fontFamilyStr = el.fontFamily === 1 ? "Virgil, Segoe UI Emoji" : el.fontFamily === 2 ? "Helvetica, Segoe UI Emoji" : el.fontFamily === 3 ? "Cascadia, Segoe UI Emoji" : "Virgil";
        ctx.font = `${el.fontSize}px ${fontFamilyStr}`;
        ctx.textBaseline = "top"; 
        
        const lines = wrappedText.split("\n");
        const lineHeightPx = el.fontSize * (el.lineHeight || 1.2);
        let currentY = el.y;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineWidth = ctx.measureText(line).width;
            let lineStartX = el.x;
            
            if (el.textAlign === "center") {
                lineStartX = el.x + el.width / 2 - lineWidth / 2;
            } else if (el.textAlign === "right") {
                lineStartX = el.x + el.width - lineWidth;
            }
            
            if (clickY >= currentY && clickY <= currentY + lineHeightPx) {
                if (clickX >= lineStartX && clickX <= lineStartX + lineWidth) {
                    let charIndexInLine = line.length - 1;
                    for (let j = 0; j < line.length; j++) {
                        const startX = lineStartX + ctx.measureText(line.substring(0, j)).width;
                        const endX = lineStartX + ctx.measureText(line.substring(0, j + 1)).width;
                        if (clickX >= startX && clickX <= endX) {
                            charIndexInLine = j;
                            break;
                        }
                    }
                    
                    const absoluteWrappedIndex = lines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0) + charIndexInLine;
                    
                    if (el.containerId) {
                        console.log("[DIAG-W] Klik mengenai huruf ke:", absoluteWrappedIndex, "di wrappedText, yaitu karakter:", JSON.stringify(wrappedText[absoluteWrappedIndex]));
                    }

                    if (!mappingValid) return null;
                    
                    const originalIndex = map[absoluteWrappedIndex];
                    if (originalIndex === -1) return null;
                    
                    if (el.containerId) {
                        console.log("[DIAG-W] Terpetakan ke originalIndex:", originalIndex, "yaitu karakter:", JSON.stringify(originalText[originalIndex]));
                    }

                    for (const mention of el.customData.mentions) {
                        let searchIndex = 0;
                        while (true) {
                            const idx = originalText.indexOf(mention.title, searchIndex);
                            if (idx === -1) break;
                            
                            if (el.containerId) {
                                console.log("[DIAG-W] Mengecek mention:", mention.title, "pada rentang ori:", idx, "sampai", idx + mention.title.length - 1);
                            }

                            if (originalIndex >= idx && originalIndex < idx + mention.title.length) {
                                if (el.containerId) {
                                    console.log("[DIAG-W] BINGO! Mention terkena klik.");
                                }
                                return mention;
                            }
                            searchIndex = idx + mention.title.length;
                        }
                    }
                }
            }
            
            currentY += lineHeightPx;
        }
        
        return null;
    };

    useEffect(() => {
        const interval = setInterval(setupMentionListener, 200);
        return () => {
            clearInterval(interval);
            if (textareaListenerRef.current && activeTextareaRef.current) {
                const old = textareaListenerRef.current;
                activeTextareaRef.current.removeEventListener("keydown", old.keydown, true);
                activeTextareaRef.current.removeEventListener("input", old.input);
            }
        };
    }, []);

    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            pointerDownScreenPosRef.current = { x: e.clientX, y: e.clientY };
        };
        const onPointerUp = (e: PointerEvent) => {
            if (pointerDownScreenPosRef.current && pointerDownMentionRef.current) {
                const dx = e.clientX - pointerDownScreenPosRef.current.x;
                const dy = e.clientY - pointerDownScreenPosRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) < 4) {
                    handleOpenAppwriteNote(pointerDownMentionRef.current.noteId);
                }
            }
            pointerDownMentionRef.current = null;
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("pointerup", onPointerUp, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("pointerup", onPointerUp, true);
        };
    }, []);

    // Track when text editing ends — set pending flag so next onChange
    // can attach mentions to the right element.
    useEffect(() => {
        const interval = setInterval(() => {
            if (mentionMenuOpen) return;
            const prev = editingTextElementIdRef.current;
            const current = excalidrawAPI?.getAppState()?.editingTextElement;
            editingTextElementIdRef.current = current?.id ?? null;

            if (prev && !editingTextElementIdRef.current) {
                // Just stopped editing element prev
                console.log("[DIAG-C] editingTextElement berubah jadi null. Memeriksa mentionEditsRef untuk", prev);
                const editsIndex = mentionEditsRef.current.findIndex(e => e.elementId === prev);
                
                if (editsIndex !== -1) {
                    const { elementId, mentions } = mentionEditsRef.current.splice(editsIndex, 1)[0];
                    console.log("[DIAG-C] Menemukan mentions pending untuk elemen", elementId, ":", mentions);
                    
                    if (excalidrawAPI) {
                        const allElements = excalidrawAPI.getSceneElements();
                        const el = allElements.find((e: any) => e.id === elementId);
                        
                        if (el && el.type === "text") {
                            const existing = el.customData?.mentions ?? [];
                            const newMentions = mentions.filter(
                                (m) => !existing.some((ex: any) => ex.noteId === m.noteId)
                            );
                            
                            if (newMentions.length > 0) {
                                console.log("[DIAG-C] updateScene dipanggil untuk elemen teks", elementId);
                                
                                const updated = allElements.map((e: any) => {
                                    if (e.id === elementId) {
                                        // Mutasi reference agar tidak rusak di cache Excalidraw, tapi
                                        // gunakan Object.assign atau cara aman Excalidraw.
                                        // Excalidraw mereturn read-only array, tapi kita memutasi properties di dalamnya (khusus customData)
                                        e.customData = { ...e.customData, mentions: [...existing, ...newMentions] };
                                        
                                        // Agar Excalidraw tahu ini berubah (secara state), kita bisa update versinya
                                        // Atau cukup panggil updateScene yang akan me-re-render
                                        return e;
                                    }
                                    return e;
                                });
                                
                                excalidrawAPI.updateScene({ elements: updated, commitToHistory: true });
                                
                                setTimeout(() => {
                                    const newEl = excalidrawAPI.getSceneElements().find((e: any) => e.id === elementId);
                                    console.log("[DIAG-C] Isi customData sesudahnya:", newEl?.customData);
                                }, 50);
                            }
                        }
                    }
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [excalidrawAPI, mentionMenuOpen]);

    useEffect(() => {
        const loadCanvas = async () => {
            try {
                const res = await databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    "canvases",
                    []
                );
                if (res.documents.length > 0) {
                    const doc = res.documents[0];
                    setCanvasId(doc.$id);
                    try {
                        const sceneData = JSON.parse(doc.scene || "[]");
                        setCanvasInitialElements(sceneData);
                        lastSavedSceneRef.current = JSON.stringify(sceneData);

                        const appwriteNoteIds = sceneData
                            .filter((el: any) => el.type === "embeddable" && el.link && el.link.startsWith("note://") && !el.link.startsWith("note://embed-"))
                            .map((el: any) => el.link.replace("note://", ""));

                        const uniqueIds = Array.from(new Set(appwriteNoteIds)) as string[];

                        if (uniqueIds.length > 0) {
                            try {
                                const titlesRes = await databases.listDocuments(
                                    APPWRITE_CONFIG.databaseId,
                                    APPWRITE_CONFIG.collectionId,
                                    [Query.equal("$id", uniqueIds)]
                                );
                                const titlesMapping: Record<string, string> = {};
                                titlesRes.documents.forEach(d => {
                                    titlesMapping[d.$id] = d.title;
                                });
                                setAppwriteTitles(titlesMapping);
                            } catch (e) {
                                console.error("Failed to fetch appwrite titles for canvas", e);
                            }
                        }
                    } catch (e) {
                        setCanvasInitialElements([]);
                        lastSavedSceneRef.current = "[]";
                    }
                } else {
                    const newDoc = await databases.createDocument(
                        APPWRITE_CONFIG.databaseId,
                        "canvases",
                        ID.unique(),
                        { title: "Kanvas Utama", scene: "[]" }
                    );
                    setCanvasId(newDoc.$id);
                    setCanvasInitialElements([]);
                    lastSavedSceneRef.current = "[]";
                }
            } catch (err) {
                console.error("Failed to load canvas:", err);
            } finally {
                setCanvasLoading(false);
            }
        };
        loadCanvas();
    }, []);



    const renderEmbeddable = (element: any, _appState: any) => {
        if (element.link && element.link.startsWith("text://")) {
            const textBoxId = element.link.replace("text://", "");
            const initialContent = textBoxContent[textBoxId] || "";
            const stopProp = (e: React.KeyboardEvent) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            };
            return (
                <div
                    style={{
                        width: "100%", height: "100%",
                        background: TEXT_BOX_BG,
                        border: `1px solid ${TEXT_BOX_BORDER}`,
                        borderRadius: 8,
                        overflow: "hidden",
                        padding: 0,
                    }}
                    onKeyDown={stopProp}
                    onKeyUp={stopProp}
                    onKeyPress={stopProp}
                >
                    <Editor
                        key={`textbox-${textBoxId}`}
                        initialContent={initialContent}
                        onChange={(json) => {
                            setTextBoxContent(prev => ({ ...prev, [textBoxId]: json }));
                            if (textBoxDebounceRef.current[textBoxId]) {
                                clearTimeout(textBoxDebounceRef.current[textBoxId]);
                            }
                            textBoxDebounceRef.current[textBoxId] = setTimeout(() => {
                                if (!excalidrawAPI) return;
                                const allElements = excalidrawAPI.getSceneElements();
                                const updated = allElements.map((el: any) =>
                                    el.id === element.id
                                        ? { ...el, customData: { ...el.customData, content: json } }
                                        : el
                                );
                                excalidrawAPI.updateScene({ elements: updated });
                            }, 800);
                        }}
                        enableMentions={true}
                        onOpenNote={handleOpenAppwriteNote}
                    />
                </div>
            );
        }

        let title = "(Tanpa judul)";
        if (element.link && element.link.startsWith("note://") && !element.link.startsWith("note://embed-")) {
            const id = element.link.replace("note://", "");
            title = appwriteTitles[id] || "(Tanpa judul)";
        } else {
            const note = notesData[element.id];
            if (note) title = note.title;
        }

        return (
            <div
                style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8,
                    overflow: "hidden", padding: 10,
                    pointerEvents: "none"
                }}
            >
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#0f172a", textAlign: "center", wordBreak: "break-word" }}>
                    {title}
                </h3>
            </div>
        );
    };

    const addEmbeddable = async () => {
        if (!excalidrawAPI) return;

        try {
            const newDoc = await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                ID.unique(),
                {
                    title: "(Tanpa judul)",
                    content: "",
                    status: "draft"
                }
            );

            setAppwriteTitles(prev => ({
                ...prev,
                [newDoc.$id]: "(Tanpa judul)"
            }));

            const newId = `box-${Date.now()}`;
            const newEmbeddable = {
                type: "embeddable",
                version: 1,
                versionNonce: 3,
                isDeleted: false,
                id: newId,
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            angle: 0,
            x: 400 + Math.random() * 50,
            y: 100 + Math.random() * 50,
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
            link: `note://${newDoc.$id}`,
            locked: false,
        };
        excalidrawAPI.updateScene({
            elements: [...excalidrawAPI.getSceneElements(), newEmbeddable]
        });
        } catch (e) {
            console.error("Gagal membuat dokumen Appwrite untuk kotak baru:", e);
        }
    };

    const addTextBox = () => {
        if (!excalidrawAPI) return;
        const newId = `text-${Date.now()}`;
        const newTextBox = {
            type: "embeddable" as const,
            version: 1,
            versionNonce: Date.now(),
            isDeleted: false,
            id: newId,
            fillStyle: "solid" as const,
            strokeWidth: 1,
            strokeStyle: "solid" as const,
            roughness: 0,
            opacity: 100,
            angle: 0,
            x: 400 + Math.random() * 50,
            y: 200 + Math.random() * 50,
            strokeColor: "#22c55e",
            backgroundColor: TEXT_BOX_BG,
            width: 280,
            height: 140,
            seed: Date.now(),
            groupIds: [],
            frameId: null,
            roundness: null,
            boundElements: [],
            updated: 1,
            link: `text://${newId}`,
            locked: false,
            customData: { content: "" },
        };
        excalidrawAPI.updateScene({
            elements: [...excalidrawAPI.getSceneElements(), newTextBox],
        });
    };

    const handleChange = (elements: readonly any[], appState: any) => {
        const selectedIds = Object.keys(appState.selectedElementIds).filter(id => appState.selectedElementIds[id]);

        let currentExcalidrawId: string | null = null;
        if (selectedIds.length === 1) {
            const el = elements.find((e: any) => e.id === selectedIds[0]);
            if (el && el.type === "embeddable") {
                currentExcalidrawId = el.id;
            }
        }

        if (currentExcalidrawId !== lastExcalidrawSelectedIdRef.current) {
            lastExcalidrawSelectedIdRef.current = currentExcalidrawId;

            if (currentExcalidrawId) {
                const el = elements.find((e: any) => e.id === currentExcalidrawId);
                const linkId = el?.link?.startsWith("note://") ? el.link.replace("note://", "") : null;

                if (linkId && !linkId.startsWith("embed-")) {
                    handleOpenAppwriteNote(linkId);
                } else {
                    console.log("[DIAG] 8 : handleChange mengubah selectedNoteId ke", currentExcalidrawId);
                    setSelectedNoteId(currentExcalidrawId);
                    console.log("[DIAG] 6 : setAppwriteNoteId dipanggil dengan null dari handleChange (memilih kotak)");
                    setAppwriteNoteId(null);
                }
            } else {
                console.log("[DIAG] 8 : handleChange menghapus selectedNoteId (menjadi null)");
                setSelectedNoteId(null);
                if (appwriteNoteId !== null) {
                    console.log("[DIAG] 8 : handleChange menghapus appwriteNoteId karena klik area kosong");
                    console.log("[DIAG] 6 : setAppwriteNoteId dipanggil dengan null dari handleChange (klik kosong)");
                    setAppwriteNoteId(null);
                }
            }
        }

        // NOTE: pending mention updates are now handled in the tracking interval (lines 177+).


        // Canvas Saving Logic
        if (canvasLoading || !canvasId) return;

        const activeElements = elements.filter(el => !el.isDeleted);
        const currentSceneString = JSON.stringify(activeElements);

        if (currentSceneString !== lastSavedSceneRef.current) {
            lastSavedSceneRef.current = currentSceneString;
            scheduleCanvasSave(currentSceneString);
        }
    };

    const scheduleCanvasSave = (sceneString: string) => {
        setCanvasSaveStatus("Kanvas: menyimpan...");
        if (debounceCanvasSaveRef.current) clearTimeout(debounceCanvasSaveRef.current);
        debounceCanvasSaveRef.current = setTimeout(async () => {
            if (!canvasId) return;
            try {
                await databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    "canvases",
                    canvasId,
                    { scene: sceneString }
                );
                setCanvasSaveStatus("Kanvas: tersimpan");
                setTimeout(() => setCanvasSaveStatus(prev => prev === "Kanvas: tersimpan" ? "" : prev), 2000);
            } catch (err) {
                console.error("Failed to save canvas scene:", err);
                setCanvasSaveStatus("Kanvas: gagal menyimpan");
            }
        }, 1500);
    };

    const handleOpenAppwriteNote = (id: string) => {
        console.log("[DIAG] 2 : handleOpenAppwriteNote dipanggil dengan id:", id);
        console.log("[DIAG] 6 : setAppwriteNoteId dipanggil dengan", id, "dari handleOpenAppwriteNote");
        setAppwriteNoteId(id);
        setSelectedNoteId(null);
        setAppwriteLoading(true);
        setAppwriteNoteData(null);
        setSaveStatus("");

        console.log("[DIAG] 3 : sebelum getDocument dipanggil");
        databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, id)
            .then(doc => {
                console.log("[DIAG] 4 : getDocument berhasil, doc.$id:", doc.$id, "content length:", doc.content?.length);
                const data = { title: doc.title, content: doc.content };
                setAppwriteNoteData(data);
                latestDataRef.current = data;
                setAppwriteLoading(false);
            })
            .catch(err => {
                console.log("[DIAG] 5 : getDocument error", err);
                console.error(err);
                if (err.code === 404) {
                    setSaveStatus("Note tidak ditemukan");
                } else {
                    setSaveStatus("Gagal memuat");
                }
                setAppwriteLoading(false);
            });
    };

    const scheduleAppwriteSave = (id: string) => {
        setSaveStatus("Menyimpan...");
        if (debounceSaveRef.current) clearTimeout(debounceSaveRef.current);
        debounceSaveRef.current = setTimeout(async () => {
            try {
                await databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    id,
                    { title: latestDataRef.current.title, content: latestDataRef.current.content }
                );
                setSaveStatus("Tersimpan");
                setTimeout(() => setSaveStatus(prev => prev === "Tersimpan" ? "" : prev), 2000);
            } catch (err) {
                console.error(err);
                setSaveStatus("Gagal menyimpan");
            }
        }, 800);
    };

    const closePanel = () => {
        // 1. Flush Appwrite save if pending
        if (debounceSaveRef.current && appwriteNoteId) {
            clearTimeout(debounceSaveRef.current);
            debounceSaveRef.current = null;
            
            // Set synchronous state to show it's saved instantly
            setSaveStatus("Tersimpan");
            
            databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                appwriteNoteId,
                { title: latestDataRef.current.title, content: latestDataRef.current.content }
            ).catch(err => {
                console.error("Flush save error:", err);
            });
        }
        
        // 2. Clear Excalidraw selection to unselect the card or mention
        if (excalidrawAPI) {
            const appState = excalidrawAPI.getAppState();
            if (Object.keys(appState.selectedElementIds).length > 0) {
                excalidrawAPI.updateScene({ appState: { selectedElementIds: {} } });
            }
        }
        
        // 3. Clear refs and states
        lastExcalidrawSelectedIdRef.current = null;
        setAppwriteNoteId(null);
        setSelectedNoteId(null);
    };

    const handleAppwriteTitleChange = (newTitle: string) => {
        if (!appwriteNoteId) return;
        setAppwriteNoteData(prev => prev ? { ...prev, title: newTitle } : null);
        latestDataRef.current.title = newTitle;
        scheduleAppwriteSave(appwriteNoteId);

        setAppwriteTitles(prev => ({
            ...prev,
            [appwriteNoteId]: newTitle
        }));
    };

    const handleAppwriteContentChange = (newContent: string) => {
        if (!appwriteNoteId) return;
        setAppwriteNoteData(prev => prev ? { ...prev, content: newContent } : null);
        latestDataRef.current.content = newContent;
        scheduleAppwriteSave(appwriteNoteId);
    };

    const handleTitleChange = (id: string, newTitle: string) => {
        setNotesData(prev => ({
            ...prev,
            [id]: { ...prev[id], title: newTitle }
        }));
    };

    const handleContentChange = (id: string, newContent: string) => {
        setNotesData(prev => ({
            ...prev,
            [id]: { ...prev[id], content: newContent }
        }));
    };

    const stopKeyboardPropagation = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") return;
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
    };

    const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "/") return;
        const target = e.target as HTMLElement;
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
        if (slashMenuOpen) return;

        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        const appState = excalidrawAPI?.getAppState();
        const zoom = appState?.zoom?.value ?? 1;
        const sceneX = lastPointerSceneRef.current.x - (appState?.scrollX ?? 0) / zoom;
        const sceneY = lastPointerSceneRef.current.y - (appState?.scrollY ?? 0) / zoom;

        setSlashMenuPosition({ x: lastPointerScreenRef.current.x, y: lastPointerScreenRef.current.y });
        setSlashMenuOpen(true);
        slashMenuScenePosRef.current = { x: sceneX, y: sceneY };
    };

    // Gather mentions from text elements that have customData.mentions
    const getMentionsForElement = (elementId: string): { noteId: string; title: string }[] => {
        if (!excalidrawAPI) return [];
        const elements = excalidrawAPI.getSceneElements();
        const el = elements.find((e: any) => e.id === elementId);
        if (!el) return [];
        // Only text elements (type === "text") carry mentions
        if (el.type !== "text") return [];
        return el.customData?.mentions ?? [];
    };

    console.log("[DIAG] 7 : render panel kanan, appwriteNoteId:", appwriteNoteId, "selectedNoteId:", selectedNoteId, "cabang:", appwriteNoteId ? "Appwrite" : (selectedNoteId ? "Welcome Note" : "None"));
    return (
        <div style={{ display: "flex", width: "100%", height: "calc(100vh - 80px)", overflow: "hidden" }}>
            {/* Canvas Area */}
            <div style={{ flex: (selectedNoteId || appwriteNoteId) ? "1 1 55%" : "1 1 100%", position: "relative", transition: "all 0.3s ease", borderRight: (selectedNoteId || appwriteNoteId) ? "1px solid #e2e8f0" : "none" }}>
                <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={addEmbeddable}
                        style={{ padding: "8px 16px", background: "#3b82f6", color: "white", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                    >
                        + Add BlockNote Box
                    </button>
                    <button
                        onClick={addTextBox}
                        style={{ padding: "8px 16px", background: "#22c55e", color: "white", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                    >
                        + Add Kotak Teks
                    </button>
                    {canvasSaveStatus && (
                        <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500, background: "rgba(255,255,255,0.8)", padding: "4px 8px", borderRadius: "4px" }}>
                            {canvasSaveStatus}
                        </span>
                    )}
                </div>
                {canvasLoading ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#64748b" }}>
                        Memuat kanvas...
                    </div>
                ) : (
                    <div onKeyDown={handleCanvasKeyDown} tabIndex={-1} style={{ height: "100%" }}>
                    <Excalidraw
                        excalidrawAPI={(api) => setExcalidrawAPI(api)}
                        initialData={{ elements: canvasInitialElements }}
                        renderEmbeddable={renderEmbeddable}
                        validateEmbeddable={() => true}
                        onChange={handleChange}
                        onPointerUpdate={({ pointer }) => {
                            lastPointerSceneRef.current = { x: pointer.x, y: pointer.y };
                            lastPointerScreenRef.current = { x: pointer.x, y: pointer.y };
                        }}
                        onPointerDown={(_activeTool, pointerDownState) => {
                            let el = pointerDownState.hit.element;
                            
                            if (el && el.boundElements && excalidrawAPI) {
                                const boundTextBinding = el.boundElements.find((b: any) => b.type === "text");
                                if (boundTextBinding) {
                                    const boundTextEl = excalidrawAPI.getSceneElements().find((e: any) => e.id === boundTextBinding.id);
                                    if (boundTextEl) {
                                        el = boundTextEl;
                                    }
                                }
                            }
                            
                            if (el && el.type === "text" && el.customData?.mentions?.length) {
                                if (excalidrawAPI?.getAppState().editingTextElement?.id === el.id) return;
                                
                                const mention = getMentionClicked(el, pointerDownState.origin.x, pointerDownState.origin.y);
                                if (mention) {
                                    pointerDownMentionRef.current = mention;
                                }
                            }
                        }}
                    />
                    </div>
                )}
            </div>

            {/* Side Panel Area */}
            {(selectedNoteId || appwriteNoteId) && (
                <div
                    style={{ flex: "0 0 45%", background: "white", display: "flex", flexDirection: "column" }}
                    onKeyDown={stopKeyboardPropagation}
                    onKeyUp={stopKeyboardPropagation}
                    onKeyPress={stopKeyboardPropagation}
                >
                    {appwriteNoteId ? (
                        <>
                            <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                {appwriteLoading ? (
                                    <div style={{ fontSize: "1.5rem", color: "#64748b" }}>Memuat...</div>
                                ) : appwriteNoteData === null && saveStatus === "Note tidak ditemukan" ? (
                                    <div style={{ fontSize: "1.2rem", color: "#ef4444", fontWeight: "bold" }}>Note tidak ditemukan</div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            value={appwriteNoteData?.title || ""}
                                            onChange={(e) => handleAppwriteTitleChange(e.target.value)}
                                            placeholder="Note Title"
                                            style={{ flex: 1, fontSize: "1.5rem", fontWeight: "bold", border: "none", outline: "none", minWidth: 0 }}
                                        />
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontSize: "0.875rem", color: "#64748b", whiteSpace: "nowrap" }}>{saveStatus}</span>
                                            <button 
                                                onClick={closePanel}
                                                style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b", padding: "4px 8px" }}
                                                title="Tutup Panel"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
                                {appwriteLoading ? (
                                    <div style={{ color: "#64748b" }}>Memuat konten...</div>
                                ) : appwriteNoteData === null && saveStatus === "Note tidak ditemukan" ? (
                                    <div style={{ color: "#ef4444" }}>Tidak ada konten untuk ditampilkan.</div>
                                ) : (
                                    <Editor
                                        key={`appwrite-${appwriteNoteId}`}
                                        initialContent={appwriteNoteData?.content || ""}
                                        onChange={(json) => handleAppwriteContentChange(json)}
                                        enableMentions={true}
                                        onOpenNote={handleOpenAppwriteNote}
                                    />
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center" }}>
                                <input
                                    type="text"
                                    value={selectedNoteId ? (notesData[selectedNoteId]?.title || "") : ""}
                                    onChange={(e) => selectedNoteId && handleTitleChange(selectedNoteId, e.target.value)}
                                    placeholder="Note Title"
                                    style={{ flex: 1, fontSize: "1.5rem", fontWeight: "bold", border: "none", outline: "none", minWidth: 0 }}
                                />
                                <button 
                                    onClick={closePanel}
                                    style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b", padding: "4px 8px", marginLeft: "10px" }}
                                    title="Tutup Panel"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Panel: mentions from the selected text element */}
                            {false && (() => {
                                const textMentions = selectedNoteId ? getMentionsForElement(selectedNoteId as string) : [];
                                if (textMentions.length > 0) {
                                    return (
                                        <div style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0" }}>
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
                                                Catatan di teks ini
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {textMentions.map((m) => (
                                                    <button
                                                        key={m.noteId}
                                                        onClick={() => handleOpenAppwriteNote(m.noteId)}
                                                        style={{
                                                            padding: "4px 12px",
                                                            background: "#eff6ff",
                                                            color: "#3b82f6",
                                                            border: "1px solid #bfdbfe",
                                                            borderRadius: "16px",
                                                            cursor: "pointer",
                                                            fontSize: "0.875rem",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        📝 {m.title}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
                                {selectedNoteId && (
                                    <Editor
                                        key={`canvas-${selectedNoteId}`}
                                        initialContent={notesData[selectedNoteId]?.content || ""}
                                        onChange={(json) => handleContentChange(selectedNoteId, json)}
                                        enableMentions={true}
                                        onOpenNote={handleOpenAppwriteNote}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {slashMenuOpen && (
                <SlashMenu
                    position={slashMenuPosition}
                    initialScenePosition={slashMenuScenePosRef.current}
                    excalidrawAPI={excalidrawAPI}
                    onNoteCreated={(id, title) => {
                        setAppwriteTitles(prev => ({ ...prev, [id]: title }));
                    }}
                    onClose={() => setSlashMenuOpen(false)}
                />
            )}

            {mentionMenuOpen && mentionMenuTextarea && (
                <SlashMenu
                    ref={slashMenuRef}
                    mode="mention"
                    mentionQuery={mentionQuery}
                    position={mentionMenuPosition}
                    onNoteCreated={(id, title) => {
                        setAppwriteTitles(prev => ({ ...prev, [id]: title }));
                    }}
                    onNoteSelected={(noteId, title) => {
                        console.log("[DIAG-M] Item dipilih. Textarea ada:", !!document.querySelector(".excalidraw-wysiwyg"), "document.activeElement:", document.activeElement?.tagName, document.activeElement?.className, "editingTextElement:", excalidrawAPI?.getAppState()?.editingTextElement?.id);
                        const elementId = editingTextElementIdRef.current;
                        const textarea = mentionMenuTextarea;
                        
                        if (textarea) {
                            console.log("[DIAG-F] Computed fontFamily saat note dipilih:", getComputedStyle(textarea).fontFamily);
                        }
                        
                        const selStart = textarea.selectionStart;
                        const val = textarea.value;
                        const startIndex = mentionStartIndexRef.current;
                        
                        if (startIndex !== -1 && val[startIndex] === "@") {
                            const newVal = val.slice(0, startIndex) + title + val.slice(selStart);
                            const newCursorPos = startIndex + title.length;
                            
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                            nativeInputValueSetter?.call(textarea, newVal);
                            
                            textarea.dispatchEvent(new Event("input", { bubbles: true }));
                            textarea.setSelectionRange(newCursorPos, newCursorPos);
                        }

                        if (elementId) {
                            const existing = mentionEditsRef.current.find(e => e.elementId === elementId);
                            if (existing) {
                                if (!existing.mentions.some(m => m.noteId === noteId)) {
                                    existing.mentions.push({ noteId, title });
                                }
                            } else {
                                mentionEditsRef.current.push({ elementId, mentions: [{ noteId, title }] });
                            }
                            console.log("[DIAG-C] Note terpilih. Tersimpan di mentionEditsRef untuk elementId:", elementId);
                        }
                        
                        setMentionMenuOpen(false);
                        setMentionMenuTextarea(null);
                        
                        textarea.focus();
                    }}
                    onClose={() => {
                        setMentionMenuOpen(false);
                        setMentionMenuTextarea(null);
                        mentionMenuTextarea.focus();
                    }}
                />
            )}
        </div>
    );
}
