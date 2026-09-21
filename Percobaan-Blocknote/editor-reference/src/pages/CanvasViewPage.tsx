import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Editor } from "../components/Editor";
import { databases, APPWRITE_CONFIG } from "../lib/appwrite";
import { Query } from "appwrite";
import { ResizablePanel } from "../components/ResizablePanel";

export function CanvasViewPage() {
    const { id: routeId } = useParams<{ id: string }>();
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const excalidrawWrapperRef = useRef<HTMLDivElement>(null);

    // State for Appwrite Note (Right Panel)
    const [appwriteNoteId, setAppwriteNoteId] = useState<string | null>(null);
    const [appwriteNoteData, setAppwriteNoteData] = useState<{ title: string; content: string; status?: string } | null>(null);
    const [appwriteLoading, setAppwriteLoading] = useState(false);
    const [noteError, setNoteError] = useState<string>("");

    // State for Canvas Scene
    const [canvasLoading, setCanvasLoading] = useState(true);
    const [canvasTitle, setCanvasTitle] = useState<string>("");
    const [canvasStatus, setCanvasStatus] = useState<string>("");
    const [canvasElements, setCanvasElements] = useState<any[]>([]);
    const [canvasError, setCanvasError] = useState<string | null>(null);

    // Mapping Appwrite Note ID -> Title
    const [appwriteTitles, setAppwriteTitles] = useState<Record<string, string>>({});
    
    const lastExcalidrawSelectedIdRef = useRef<string | null>(null);
    const pointerDownScreenPosRef = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const loadCanvas = async () => {
            if (!routeId) return;
            try {
                const doc = await databases.getDocument(
                    APPWRITE_CONFIG.databaseId,
                    "canvases",
                    routeId
                );
                
                if (doc.status === "trashed") {
                    setCanvasError("Kanvas tidak tersedia");
                    setCanvasLoading(false);
                    return;
                }

                setCanvasTitle(doc.title || "(Tanpa judul)");
                setCanvasStatus(doc.status || "draft");
                
                try {
                    const sceneData = JSON.parse(doc.scene || "[]");
                    setCanvasElements(sceneData);

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
                    setCanvasElements([]);
                }
            } catch (err: any) {
                console.error("Failed to load canvas:", err);
                if (err.code === 404) {
                    setCanvasError("Kanvas tidak ditemukan");
                } else {
                    setCanvasError("Gagal memuat kanvas");
                }
            } finally {
                setCanvasLoading(false);
            }
        };
        loadCanvas();
    }, [routeId]);

    const getMentionClicked = (el: any, clickX: number, clickY: number) => {
        if (!el.customData?.mentions?.length) return null;

        const originalText = el.originalText || el.text;
        const wrappedText = el.text;
        
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

        if (!mappingValid) return null;

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
                    const originalIndex = map[absoluteWrappedIndex];
                    if (originalIndex === -1) return null;

                    for (const mention of el.customData.mentions) {
                        let searchIndex = 0;
                        while (true) {
                            const idx = originalText.indexOf(mention.title, searchIndex);
                            if (idx === -1) break;
                            
                            if (originalIndex >= idx && originalIndex < idx + mention.title.length) {
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

    // Global listeners removed, replaced with capture phase on wrapper
    useEffect(() => {
        const handleWindowPointerUp = (e: PointerEvent) => {
            console.log("[DIAG-G] 1b: window bubble pointerup diterima", e.type);
            setTimeout(() => {
                const canvas = document.querySelector(".excalidraw canvas.interactive") as HTMLCanvasElement;
                if (canvas) {
                    console.log("[DIAG-G] 1c: style.cursor pada canvas setelah 300ms:", canvas.style.cursor);
                }
            }, 300);
            const canvas = document.querySelector(".excalidraw canvas.interactive") as HTMLCanvasElement;
            if (canvas) {
                console.log("[DIAG-G] 1c: style.cursor pada canvas sesaat setelah pointerup:", canvas.style.cursor);
            }
        };
        window.addEventListener("pointerup", handleWindowPointerUp);
        return () => window.removeEventListener("pointerup", handleWindowPointerUp);
    }, []);

    const renderEmbeddable = (element: any, _appState: any) => {
        console.log("[DIAG-V] 1b: renderEmbeddable dipanggil untuk:", element.link);
        let title = "(Tanpa judul)";
        if (element.link && element.link.startsWith("note://") && !element.link.startsWith("note://embed-")) {
            const id = element.link.replace("note://", "");
            title = appwriteTitles[id] || "(Tanpa judul)";
        } else {
            // Memory note tidak perlu di view
        }

        return (
            <div
                onClick={() => console.log("[DIAG-V] 1b: onClick pada div card")}
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

    const handleOpenAppwriteNote = (id: string) => {
        setAppwriteNoteId(id);
        setSelectedNoteId(null);
        setAppwriteLoading(true);
        setAppwriteNoteData(null);
        setNoteError("");

        databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, id)
            .then(doc => {
                if (doc.status === "trashed") {
                    setNoteError("Note tidak tersedia");
                } else {
                    setAppwriteNoteData({ title: doc.title, content: doc.content, status: doc.status });
                }
                setAppwriteLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (err.code === 404) {
                    setNoteError("Note tidak tersedia");
                } else {
                    setNoteError("Gagal memuat note");
                }
                setAppwriteLoading(false);
            });
    };

    const handleChange = (elements: readonly any[], appState: any) => {
        console.log("[DIAG-V] 1a: onChange dipanggil");
        // Fallback kalau viewMode tidak mematikan selection
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
                    setSelectedNoteId(currentExcalidrawId);
                    setAppwriteNoteId(null);
                }
            } else {
                setSelectedNoteId(null);
                if (appwriteNoteId !== null) {
                    setAppwriteNoteId(null);
                }
            }
        }
    };

    const closePanel = () => {
        setAppwriteNoteId(null);
        setSelectedNoteId(null);
    };

    if (canvasError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-gray-600">
                <h2 className="text-2xl font-bold mb-4">{canvasError}</h2>
                <Link to="/admin" className="text-blue-600 hover:underline">← Dashboard</Link>
            </div>
        );
    }

    const handleWrapperPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        console.log("[DIAG-V] 1c: pointerdown native diterima pembungkus");
        console.log("[DIAG-G] 1a: pointerdown di handleWrapperPointerDown");
        pointerDownScreenPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleWrapperPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        console.log("[DIAG-V] 1c: pointerup native diterima pembungkus");
        console.log("[DIAG-G] 1a: pointerup di handleWrapperPointerUp");
        if (!pointerDownScreenPosRef.current || !excalidrawAPI) return;
        
        const dx = e.clientX - pointerDownScreenPosRef.current.x;
        const dy = e.clientY - pointerDownScreenPosRef.current.y;
        
        if (e.button === 0 && Math.sqrt(dx * dx + dy * dy) < 4) {
            if (!excalidrawWrapperRef.current) return;
            
            const rect = excalidrawWrapperRef.current.getBoundingClientRect();
            const appState = excalidrawAPI.getAppState();
            
            const sceneX = (e.clientX - rect.left) / appState.zoom.value - appState.scrollX;
            const sceneY = (e.clientY - rect.top) / appState.zoom.value - appState.scrollY;

            const elements = excalidrawAPI.getSceneElements().filter((el: any) => !el.isDeleted);
            
            for (let i = elements.length - 1; i >= 0; i--) {
                const el = elements[i];
                
                // Embeddable Note Card
                if (el.type === "embeddable" && el.link && el.link.startsWith("note://") && !el.link.startsWith("note://embed-")) {
                    if (sceneX >= el.x && sceneX <= el.x + el.width &&
                        sceneY >= el.y && sceneY <= el.y + el.height) {
                        
                        console.log("[DIAG-G] 1a: mengenai embeddable note, tidak memanggil stopPropagation");
                        const linkId = el.link.replace("note://", "");
                        handleOpenAppwriteNote(linkId);
                        return;
                    }
                }

                // Text mention
                if (el.type === "text" && el.customData?.mentions?.length) {
                    if (sceneX >= el.x && sceneX <= el.x + el.width &&
                        sceneY >= el.y && sceneY <= el.y + el.height) {
                        
                        const mention = getMentionClicked(el, sceneX, sceneY);
                        if (mention) {
                            console.log("[DIAG-G] 1a: mengenai text mention, tidak memanggil stopPropagation");
                            handleOpenAppwriteNote(mention.noteId);
                            return;
                        }
                    }
                }
                
                // Shapes with bound text mentions
                if (el.boundElements?.length) {
                    const textElementIds = el.boundElements.filter((b: any) => b.type === "text").map((b: any) => b.id);
                    for (const textId of textElementIds) {
                        const textEl = elements.find((t: any) => t.id === textId);
                        if (textEl && textEl.customData?.mentions?.length) {
                            if (sceneX >= textEl.x && sceneX <= textEl.x + textEl.width &&
                                sceneY >= textEl.y && sceneY <= textEl.y + textEl.height) {
                                
                                const mention = getMentionClicked(textEl, sceneX, sceneY);
                                if (mention) {
                                    console.log("[DIAG-G] 1a: mengenai bound text mention, tidak memanggil stopPropagation");
                                    handleOpenAppwriteNote(mention.noteId);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        pointerDownScreenPosRef.current = null;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100vh", overflow: "hidden" }}>
            {/* Top Bar */}
            <div style={{ height: "60px", flexShrink: 0, display: "flex", alignItems: "center", padding: "0 24px", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", justifyContent: "space-between" }}>
                <h1 className="text-xl font-bold text-gray-800">{canvasTitle}</h1>
                {canvasStatus !== "published" && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                        Draft, belum dipublikasikan
                    </span>
                )}
            </div>
            
            {/* Main Area */}
            <div style={{ display: "flex", flex: 1, width: "100%", overflow: "hidden" }}>
                {canvasLoading ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#64748b" }}>
                        Memuat kanvas...
                    </div>
                ) : (
                    <div 
                        ref={excalidrawWrapperRef}
                        onPointerDownCapture={handleWrapperPointerDown}
                        onPointerUpCapture={handleWrapperPointerUp}
                        style={{ flex: 1, position: "relative", minWidth: 0, transition: "none", borderRight: (selectedNoteId || appwriteNoteId) ? "1px solid #e2e8f0" : "none" }}
                    >
                        <Excalidraw
                            excalidrawAPI={(api) => setExcalidrawAPI(api)}
                            initialData={{ elements: canvasElements }}
                            renderEmbeddable={renderEmbeddable}
                            validateEmbeddable={() => true}
                            viewModeEnabled={true}
                            onChange={handleChange}
                            onPointerDown={(_activeTool, pointerDownState) => {
                                console.log("[DIAG-V] 1a: onPointerDown Excalidraw, hit:", pointerDownState.hit?.element?.id);
                            }}
                        />
                    </div>
                )}

                {/* Panel Kanan */}
                {(selectedNoteId || appwriteNoteId) && (
                    <ResizablePanel
                        onClose={closePanel}
                        title={
                            appwriteNoteId && appwriteLoading ? (
                                <span style={{ color: "#64748b" }}>Memuat note...</span>
                            ) : appwriteNoteId && noteError ? (
                                <span style={{ color: "#ef4444", fontWeight: 500 }}>Error</span>
                            ) : (
                                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {appwriteNoteId && appwriteNoteData ? appwriteNoteData.title || "(Tanpa judul)" : "(Note Canvas Internal)"}
                                </h2>
                            )
                        }
                    >
                        {appwriteNoteId ? (
                            appwriteLoading ? (
                                <div style={{ color: "#64748b" }}>Memuat isi...</div>
                            ) : noteError ? (
                                <div style={{ color: "#ef4444", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "8px" }}>
                                    {noteError}
                                </div>
                            ) : appwriteNoteData ? (
                                <div className="prose max-w-none">
                                    <Editor 
                                        initialContent={appwriteNoteData.content} 
                                        editable={false}
                                        enableMentions={true}
                                        onOpenNote={handleOpenAppwriteNote}
                                    />
                                </div>
                            ) : null
                        ) : (
                            <div style={{ color: "#64748b" }}>
                                Memori Note Canvas Internal.
                            </div>
                        )}
                    </ResizablePanel>
                )}
            </div>
        </div>
    );
}
