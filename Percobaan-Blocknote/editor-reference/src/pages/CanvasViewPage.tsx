import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Editor } from "../components/Editor";
import { databases, APPWRITE_CONFIG } from "../lib/appwrite";
import { ResizablePanel } from "../components/ResizablePanel";

function CanvasSceneLoader({
    elements,
    files,
    onMentionClick,
}: {
    elements: any[];
    files: Record<string, any>;
    onMentionClick: (noteId: string) => void;
}) {
    const excalidrawWrapperRef = useRef<HTMLDivElement>(null);
    const excalidrawAPIRef = useRef<any>(null);
    const pointerDownScreenPosRef = useRef<{ x: number; y: number } | null>(null);

    console.log("[DIAG-V] CanvasSceneLoader mount — elements:", elements.length, "files:", Object.keys(files).length);

    // ── getMentionClicked — salin utuh dari versi asli ─────────────────────────
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
                                console.log("[DIAG-V] mention ditemukan — noteId:", mention.noteId, "title:", mention.title);
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

    // ── handleWrapperPointerDown — salin utuh, ref di module scope child ───────
    const handleWrapperPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        console.log("[DIAG-V] pointerdown di wrapper");
        pointerDownScreenPosRef.current = { x: e.clientX, y: e.clientY };
    };

    // ── handleWrapperPointerUp — salin utuh, handleOpenAppwriteNote diganti onMentionClick ─
    const handleWrapperPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        console.log("[DIAG-V] pointerup di wrapper");
        if (!pointerDownScreenPosRef.current || !excalidrawAPIRef.current) return;

        const dx = e.clientX - pointerDownScreenPosRef.current.x;
        const dy = e.clientY - pointerDownScreenPosRef.current.y;

        if (e.button === 0 && Math.sqrt(dx * dx + dy * dy) < 4) {
            if (!excalidrawWrapperRef.current) return;

            const rect = excalidrawWrapperRef.current.getBoundingClientRect();
            const appState = excalidrawAPIRef.current.getAppState();

            const sceneX = (e.clientX - rect.left) / appState.zoom.value - appState.scrollX;
            const sceneY = (e.clientY - rect.top) / appState.zoom.value - appState.scrollY;

            const sceneElements = excalidrawAPIRef.current.getSceneElements().filter((el: any) => !el.isDeleted);

            for (let i = sceneElements.length - 1; i >= 0; i--) {
                const el = sceneElements[i];

                // Embeddable Note Card
                if (el.type === "embeddable" && el.link && el.link.startsWith("note://") && !el.link.startsWith("note://embed-")) {
                    if (sceneX >= el.x && sceneX <= el.x + el.width &&
                        sceneY >= el.y && sceneY <= el.y + el.height) {
                        console.log("[DIAG-V] klik mengenai embeddable note");
                        const linkId = el.link.replace("note://", "");
                        console.log("[DIAG-V] onMentionClick dipanggil dengan noteId:", linkId);
                        onMentionClick(linkId);
                        return;
                    }
                }

                // Text mention
                if (el.type === "text" && el.customData?.mentions?.length) {
                    if (sceneX >= el.x && sceneX <= el.x + el.width &&
                        sceneY >= el.y && sceneY <= el.y + el.height) {
                        const mention = getMentionClicked(el, sceneX, sceneY);
                        if (mention) {
                            console.log("[DIAG-V] onMentionClick dipanggil dari text mention — noteId:", mention.noteId);
                            onMentionClick(mention.noteId);
                            return;
                        }
                    }
                }

                // Shapes with bound text mentions
                if (el.boundElements?.length) {
                    const textElementIds = el.boundElements.filter((b: any) => b.type === "text").map((b: any) => b.id);
                    for (const textId of textElementIds) {
                        const textEl = sceneElements.find((t: any) => t.id === textId);
                        if (textEl && textEl.customData?.mentions?.length) {
                            if (sceneX >= textEl.x && sceneX <= textEl.x + textEl.width &&
                                sceneY >= textEl.y && sceneY <= textEl.y + textEl.height) {
                                const mention = getMentionClicked(textEl, sceneX, sceneY);
                                if (mention) {
                                    console.log("[DIAG-V] onMentionClick dipanggil dari bound text mention — noteId:", mention.noteId);
                                    onMentionClick(mention.noteId);
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

    const handleChange = (_els: readonly any[], _appState: any) => {
        console.log("[DIAG-V] onChange dipanggil, elements:", _els.length);
    };

    return (
        <div
            ref={excalidrawWrapperRef}
            onPointerDownCapture={handleWrapperPointerDown}
            onPointerUpCapture={handleWrapperPointerUp}
            style={{ flex: 1, position: "relative", minWidth: 0, transition: "none" }}
        >
            <Excalidraw
                excalidrawAPI={(api) => {
                    excalidrawAPIRef.current = api;
                }}
                initialData={{ elements, files }}
                renderEmbeddable={(element, _appState) => {
                    let title = "(Tanpa judul)";
                    if (element.link && element.link.startsWith("note://") && !element.link.startsWith("note://embed-")) {
                        title = element.link.replace("note://", "");
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
                }}
                validateEmbeddable={() => true}
                viewModeEnabled={true}
                onChange={handleChange}
            />
        </div>
    );
}

export function CanvasViewPage() {
    const { id: routeId } = useParams<{ id: string }>();

    const [appwriteNoteId, setAppwriteNoteId] = useState<string | null>(null);
    const [appwriteNoteData, setAppwriteNoteData] = useState<{ title: string; content: string; status?: string } | null>(null);
    const [appwriteLoading, setAppwriteLoading] = useState(false);
    const [noteError, setNoteError] = useState<string>("");

    const [canvasLoading, setCanvasLoading] = useState(true);
    const [canvasTitle, setCanvasTitle] = useState<string>("");
    const [canvasStatus, setCanvasStatus] = useState<string>("");
    const [canvasElements, setCanvasElements] = useState<any[]>([]);
    const [canvasFiles, setCanvasFiles] = useState<Record<string, any>>({});
    const [canvasError, setCanvasError] = useState<string | null>(null);

    useEffect(() => {
        const loadCanvas = async () => {
            if (!routeId) return;
            console.log("[DIAG-V] loadCanvas mulai");
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
                    const raw = JSON.parse(doc.scene || "[]");
                    const sceneData = Array.isArray(raw) ? raw : (raw.elements || []);
                    const sceneFiles: Record<string, any> = (raw as any).files || {};
                    console.log("[DIAG-V] parsed — elements:", sceneData.length, "files:", Object.keys(sceneFiles).length);
                    setCanvasElements(sceneData);
                    setCanvasFiles(sceneFiles);
                } catch (e) {
                    setCanvasElements([]);
                    setCanvasFiles({});
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
                console.log("[DIAG-V] useEffect selesai, setCanvasLoading(false)");
            }
        };
        loadCanvas();
    }, [routeId]);

    const handleOpenAppwriteNote = (id: string) => {
        console.log("[DIAG-V] handleOpenAppwriteNote dipanggil — id:", id);
        setAppwriteNoteId(id);
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

    const closePanel = () => {
        setAppwriteNoteId(null);
        setAppwriteNoteData(null);
    };

    if (canvasError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-gray-600">
                <h2 className="text-2xl font-bold mb-4">{canvasError}</h2>
                <Link to="/admin" className="text-blue-600 hover:underline">← Dashboard</Link>
            </div>
        );
    }

    console.log("[DIAG-V] render — canvasLoading:", canvasLoading, "elements:", canvasElements.length, "files:", Object.keys(canvasFiles).length);

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100vh", overflow: "hidden" }}>
            <div style={{ height: "60px", flexShrink: 0, display: "flex", alignItems: "center", padding: "0 24px", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", justifyContent: "space-between" }}>
                <h1 className="text-xl font-bold text-gray-800">{canvasTitle}</h1>
                {canvasStatus !== "published" && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                        Draft, belum dipublikasikan
                    </span>
                )}
            </div>

            <div style={{ display: "flex", flex: 1, width: "100%", overflow: "hidden" }}>
                {canvasLoading ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#64748b" }}>
                        Memuat kanvas...
                    </div>
                ) : (
                    <div style={{ display: "flex", flex: 1, overflow: "hidden", borderRight: (appwriteNoteId) ? "1px solid #e2e8f0" : "none" }}>
                        <CanvasSceneLoader
                            key={routeId}
                            elements={canvasElements}
                            files={canvasFiles}
                            onMentionClick={handleOpenAppwriteNote}
                        />
                    </div>
                )}

                {appwriteNoteId && (
                    <ResizablePanel
                        onClose={closePanel}
                        title={
                            appwriteLoading ? (
                                <span style={{ color: "#64748b" }}>Memuat note...</span>
                            ) : noteError ? (
                                <span style={{ color: "#ef4444", fontWeight: 500 }}>Error</span>
                            ) : (
                                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {appwriteNoteData ? appwriteNoteData.title || "(Tanpa judul)" : "(Tanpa judul)"}
                                </h2>
                            )
                        }
                    >
                        {appwriteLoading ? (
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
                        ) : null}
                    </ResizablePanel>
                )}
            </div>
        </div>
    );
}
