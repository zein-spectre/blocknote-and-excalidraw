import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

export const MIN_PANEL_WIDTH = 320;
export const MAX_PANEL_WIDTH_RATIO = 0.65;
export const MIN_CANVAS_WIDTH = 300;
export const DEFAULT_PANEL_WIDTH = 450;
const STORAGE_KEY = "canvas-panel-width";

interface ResizablePanelProps {
    children: React.ReactNode;
    onClose: () => void;
    title: React.ReactNode;
    headerRight?: React.ReactNode;
}

export function ResizablePanel({ children, onClose, title, headerRight }: ResizablePanelProps) {
    const [width, setWidth] = useState<number>(DEFAULT_PANEL_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const initialWidthRef = useRef<number>(0);
    const initialMouseXRef = useRef<number>(0);

    // Initialize width from localStorage and validate against bounds
    useEffect(() => {
        const checkAndClampWidth = (currentWidth: number) => {
            const maxAllowed = Math.min(
                window.innerWidth * MAX_PANEL_WIDTH_RATIO,
                window.innerWidth - MIN_CANVAS_WIDTH
            );
            // If window is very small, minimum width wins over max constraints
            const clamped = Math.max(MIN_PANEL_WIDTH, Math.min(currentWidth, Math.max(MIN_PANEL_WIDTH, maxAllowed)));
            return clamped;
        };

        const stored = localStorage.getItem(STORAGE_KEY);
        let initialW = DEFAULT_PANEL_WIDTH;
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed)) {
                initialW = parsed;
            }
        }
        
        setWidth(checkAndClampWidth(initialW));

        const handleResize = () => {
            setWidth(prev => checkAndClampWidth(prev));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Inject styles during resize to prevent text selection and excalidraw interference
    useEffect(() => {
        if (isResizing) {
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
            
            // Disable pointer events on Excalidraw containers to avoid eating mouse events
            const excalidrawContainers = document.querySelectorAll('.excalidraw-container');
            excalidrawContainers.forEach((el) => {
                (el as HTMLElement).style.pointerEvents = "none";
            });
        } else {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
            
            const excalidrawContainers = document.querySelectorAll('.excalidraw-container');
            excalidrawContainers.forEach((el) => {
                (el as HTMLElement).style.pointerEvents = "auto";
            });
        }
        return () => {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
            const excalidrawContainers = document.querySelectorAll('.excalidraw-container');
            excalidrawContainers.forEach((el) => {
                (el as HTMLElement).style.pointerEvents = "auto";
            });
        };
    }, [isResizing]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Only left click
        setIsResizing(true);
        initialWidthRef.current = width;
        initialMouseXRef.current = e.clientX;
        if (resizeHandleRef.current) {
            resizeHandleRef.current.setPointerCapture(e.pointerId);
        }
        e.stopPropagation();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isResizing) return;
        // Panel is on the right, dragging left increases width, dragging right decreases width
        const deltaX = initialMouseXRef.current - e.clientX;
        let newWidth = initialWidthRef.current + deltaX;

        const maxAllowed = Math.min(
            window.innerWidth * MAX_PANEL_WIDTH_RATIO,
            window.innerWidth - MIN_CANVAS_WIDTH
        );
        newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, Math.max(MIN_PANEL_WIDTH, maxAllowed)));
        
        setWidth(newWidth);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isResizing) return;
        setIsResizing(false);
        if (resizeHandleRef.current) {
            resizeHandleRef.current.releasePointerCapture(e.pointerId);
        }
        localStorage.setItem(STORAGE_KEY, width.toString());
        e.stopPropagation();
    };

    const handleDoubleClick = () => {
        setWidth(DEFAULT_PANEL_WIDTH);
        localStorage.setItem(STORAGE_KEY, DEFAULT_PANEL_WIDTH.toString());
    };

    return (
        <div style={{ 
            width: `${width}px`, 
            flexShrink: 0,
            height: "100%", 
            backgroundColor: "#fff", 
            display: "flex", 
            flexDirection: "row", // Include the resizer on the left
            position: "relative",
            borderLeft: "1px solid #e2e8f0"
        }}>
            {/* Resizer Handle */}
            <div
                ref={resizeHandleRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                style={{
                    width: "8px",
                    cursor: "col-resize",
                    position: "absolute",
                    left: -4, // Center it over the border
                    top: 0,
                    bottom: 0,
                    zIndex: 50,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.2)" }}
                onMouseOut={(e) => { 
                    if (!isResizing) e.currentTarget.style.backgroundColor = "transparent" 
                }}
                className={isResizing ? "bg-blue-100" : ""}
            >
                <div style={{ width: "2px", height: "100%", backgroundColor: isResizing ? "#3b82f6" : "transparent", transition: "background-color 0.2s" }} />
            </div>

            {/* Panel Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", backgroundColor: "#fff" }} className="resizable-panel">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                    <div style={{ flex: 1, marginRight: "12px", overflow: "hidden", display: "flex", alignItems: "center" }}>
                        {title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        {headerRight}
                        <button
                            onClick={onClose}
                            style={{ padding: "8px", color: "#64748b", background: "transparent", border: "none", cursor: "pointer", borderRadius: "8px" }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e2e8f0"}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1, padding: "24px", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
