import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote, createReactInlineContentSpec, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { storage, APPWRITE_CONFIG, ID, databases } from "../lib/appwrite";
import { createReactMathBlockSpec, createReactInlineMathSpec } from "@blocknote/math-block";
import { Query } from "appwrite";
import { useRef, createContext, useContext } from "react";

const EditorContext = createContext<{ onOpenNote?: (noteId: string) => void }>({});

const NoteMention = createReactInlineContentSpec(
  {
    type: "noteMention",
    propSchema: {
      noteId: { default: "unknown" },
      title: { default: "Untitled" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { onOpenNote } = useContext(EditorContext);
      return (
          <span 
              style={{ backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: "12px", cursor: "pointer", color: "#1e293b", fontWeight: 500 }}
              onClick={() => {
                  console.log("[DIAG] 1 : di onClick chip noteMention. noteId:", props.inlineContent.props.noteId, "title:", props.inlineContent.props.title, "typeof onOpenNote:", typeof onOpenNote);
                  if (onOpenNote) {
                      onOpenNote(props.inlineContent.props.noteId);
                  }
              }}
          >
            📝 {props.inlineContent.props.title}
          </span>
      );
    },
  }
);

const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        mathBlock: createReactMathBlockSpec(),
    },
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        math: createReactInlineMathSpec(),
        noteMention: NoteMention,
    },
});

function parseChatGPTMarkdown(text: string, editor: any) {
    // 1. Split text into block math and non-block math
    const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;
    const blocks: any[] = [];
    
    let lastIndex = 0;
    let match;
    
    while ((match = blockMathRegex.exec(text)) !== null) {
        const beforeText = text.substring(lastIndex, match.index);
        if (beforeText.trim()) {
            blocks.push(...editor.tryParseMarkdownToBlocks(beforeText));
        }
        
        blocks.push({
            type: "mathBlock",
            content: match[1].trim()
        });
        
        lastIndex = blockMathRegex.lastIndex;
    }
    
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
        blocks.push(...editor.tryParseMarkdownToBlocks(remainingText));
    }
    
    // 2. Process inline math
    function processInlineMath(content: any[]): any[] {
        if (!content || !Array.isArray(content)) return content;
        
        const newContent: any[] = [];
        // Strict inline math regex: no spaces immediately after opening $ or before closing $
        const inlineMathRegex = /(\$[^ \$\n](?:[^\$]*[^ \$\n])?\$)/g;
        
        for (const item of content) {
            if (item.type === "text" && item.text && item.text.includes("$")) {
                const parts = item.text.split(inlineMathRegex);
                for (const part of parts) {
                    if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
                        newContent.push({
                            type: "math",
                            content: part.substring(1, part.length - 1)
                        });
                    } else if (part.length > 0) {
                        newContent.push({
                            ...item,
                            text: part
                        });
                    }
                }
            } else {
                newContent.push(item);
            }
        }
        return newContent;
    }
    
    function recursivelyProcessBlocks(bList: any[]) {
        for (const b of bList) {
            if (b.content) {
                b.content = processInlineMath(b.content);
            }
            if (b.children && b.children.length > 0) {
                recursivelyProcessBlocks(b.children);
            }
        }
    }
    
    recursivelyProcessBlocks(blocks);
    
    return blocks;
}

interface EditorProps {
    initialContent?: string;
    onChange?: (jsonContent: string) => void;
    editable?: boolean;
    enableMentions?: boolean;
    onOpenNote?: (noteId: string) => void;
}

export function Editor({ initialContent, onChange, editable = true, enableMentions = false, onOpenNote }: EditorProps) {
    let initialBlocks: any = undefined;
    
    if (initialContent) {
        try {
            initialBlocks = JSON.parse(initialContent);
        } catch (e) {
            console.error("Failed to parse initial content", e);
        }
    }

    const editor = useCreateBlockNote({
        schema,
        initialContent: initialBlocks,
        pasteHandler: (context) => {
            const clipboard = context.event.clipboardData;
            if (!clipboard) return context.defaultPasteHandler();

            if (clipboard.files && clipboard.files.length > 0) {
                return context.defaultPasteHandler();
            }

            const htmlText = clipboard.getData("text/html");
            if (htmlText && htmlText.includes("data-pm-slice")) {
                return context.defaultPasteHandler();
            }

            const plainText = clipboard.getData("text/plain");
            
            const hasBlockMath = /\$\$[\s\S]+?\$\$/.test(plainText);
            const hasInlineMath = /\$[^ \$\n](?:[^\$]*[^ \$\n])?\$/.test(plainText);

            if (plainText && (hasBlockMath || hasInlineMath)) {
                context.event.preventDefault();
                
                const blocks = parseChatGPTMarkdown(plainText, context.editor);
                
                if (blocks.length === 1 && blocks[0].type === "paragraph" && (!blocks[0].children || blocks[0].children.length === 0)) {
                    context.editor.insertInlineContent(blocks[0].content || []);
                } else {
                    const selection = context.editor.getTextCursorPosition();
                    context.editor.insertBlocks(blocks, selection.block, "after");
                    
                    if (!selection.block.content || (Array.isArray(selection.block.content) && selection.block.content.length === 0)) {
                        context.editor.removeBlocks([selection.block]);
                    }
                }
                
                return true;
            }
            
            return context.defaultPasteHandler();
        },
        uploadFile: async (file: File) => {
            const uploadedFile = await storage.createFile(
                APPWRITE_CONFIG.bucketId,
                ID.unique(),
                file
            );
            const url = storage.getFileView(APPWRITE_CONFIG.bucketId, uploadedFile.$id);
            return url.toString();
        },
    });

    const debounceRef = useRef<any>(null);

    const getMentionItems = async (query: string) => {
        return new Promise<any[]>((resolve) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                try {
                    const queries = [Query.limit(10), Query.orderDesc('$createdAt')];
                    if (query) {
                        queries.push(Query.search("title", query));
                    }
                    
                    const response = await databases.listDocuments(
                        APPWRITE_CONFIG.databaseId,
                        APPWRITE_CONFIG.collectionId,
                        queries
                    );

                    const exactMatch = response.documents.find(d => d.title.toLowerCase() === query.toLowerCase());

                    const items = response.documents.map((doc) => ({
                        title: doc.title,
                        onItemClick: () => {
                            editor.insertInlineContent([
                                {
                                    type: "noteMention",
                                    props: { noteId: doc.$id, title: doc.title }
                                } as any,
                                " "
                            ]);
                        }
                    }));

                    if (query.trim() !== "" && !exactMatch) {
                        items.unshift({
                            title: `Create new note: "${query}"`,
                            onItemClick: async () => {
                                const title = query;
                                try {
                                    const newDoc = await databases.createDocument(
                                        APPWRITE_CONFIG.databaseId,
                                        APPWRITE_CONFIG.collectionId,
                                        ID.unique(),
                                        {
                                            title: title,
                                            content: "",
                                            status: "draft"
                                        }
                                    );
                                    editor.insertInlineContent([
                                        {
                                            type: "noteMention",
                                            props: { noteId: newDoc.$id, title: newDoc.title }
                                        } as any,
                                        " "
                                    ]);
                                } catch (err) {
                                    console.error("Failed to create note", err);
                                }
                            }
                        });
                    }

                    resolve(items);
                } catch (e) {
                    console.error(e);
                    resolve([]);
                }
            }, 250);
        });
    };

    return (
        <EditorContext.Provider value={{ onOpenNote }}>
            <div className={editable ? "border border-gray-200 rounded-lg p-2 min-h-[500px] bg-white shadow-sm" : ""}>
                <BlockNoteView 
                    editor={editor} 
                    editable={editable}
                    onChange={() => {
                        if (onChange) {
                            onChange(JSON.stringify(editor.document));
                        }
                    }}
                    theme="light"
                    slashMenu={!enableMentions}
                >
                    {enableMentions && (
                        <SuggestionMenuController
                            triggerCharacter={"/"}
                            getItems={async (query) => {
                                const defaultItems = getDefaultReactSlashMenuItems(editor);
                                const customItem = {
                                    title: "Link to note",
                                    onItemClick: () => {
                                        editor.insertInlineContent("@");
                                    },
                                    aliases: ["mention", "note", "link"],
                                    group: "Other",
                                    icon: <span style={{ fontSize: "18px" }}>📝</span>,
                                    subtext: "Mention or create a note"
                                };
                                return [...defaultItems, customItem].filter(item => 
                                    item.title.toLowerCase().includes(query.toLowerCase()) || 
                                    (item.aliases && item.aliases.some(a => a.toLowerCase().includes(query.toLowerCase())))
                                );
                            }}
                        />
                    )}
                    {enableMentions && (
                        <SuggestionMenuController
                            triggerCharacter={"@"}
                            getItems={getMentionItems}
                        />
                    )}
                </BlockNoteView>
            </div>
        </EditorContext.Provider>
    );
}
