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

    // Text box editor state (key = element id, value = JSON string of blocks)
    const [textBoxContent, setTextBoxContent] = useState<Record<string, string>>({});
    const textBoxDebounceRef = useRef<Record<string, any>>({});

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
                                            style={{ flex: 1, fontSize: "1.5rem", fontWeight: "bold", border: "none", outline: "none" }}
                                        />
                                        <span style={{ fontSize: "0.875rem", color: "#64748b", whiteSpace: "nowrap", marginLeft: 10 }}>{saveStatus}</span>
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
                            <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
                                <input 
                                    type="text" 
                                    value={selectedNoteId ? (notesData[selectedNoteId]?.title || "") : ""}
                                    onChange={(e) => selectedNoteId && handleTitleChange(selectedNoteId, e.target.value)}
                                    placeholder="Note Title"
                                    style={{ width: "100%", fontSize: "1.5rem", fontWeight: "bold", border: "none", outline: "none" }}
                                />
                            </div>
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
        </div>
    );
}
