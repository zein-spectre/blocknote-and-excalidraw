import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Editor } from "../components/Editor";
import { databases, APPWRITE_CONFIG, ID } from "../lib/appwrite";
import { ArrowLeft, Save, Send } from "lucide-react";

export function AdminEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = id === "new";

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [status, setStatus] = useState("draft");
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isNew && id) {
            databases.getDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                id
            ).then((doc) => {
                setTitle(doc.title);
                setContent(doc.content);
                setStatus(doc.status);
                setLoading(false);
            }).catch((err) => {
                console.error("Failed to load article:", err);
                alert("Article not found!");
                navigate("/admin");
            });
        }
    }, [id, isNew, navigate]);

    const handleSave = async (newStatus: "draft" | "published") => {
        setSaving(true);
        try {
            const data = {
                title: title || "Untitled Article",
                content,
                status: newStatus
            };

            if (isNew) {
                await databases.createDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    ID.unique(),
                    data
                );
            } else if (id) {
                await databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    id,
                    data
                );
            }
            alert(`Article successfully ${newStatus === 'published' ? 'published' : 'saved as draft'}!`);
            navigate("/admin");
        } catch (error) {
            console.error("Error saving document:", error);
            alert("Failed to save the article.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading editor...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/admin" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-2xl font-bold flex-1 text-gray-900">
                    {isNew ? "Write New Article" : "Edit Article"} 
                    {!isNew && <span className="text-sm font-normal text-gray-500 ml-3">({status})</span>}
                </h1>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleSave("draft")}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                    >
                        <Save size={18} />
                        Save Draft
                    </button>
                    <button 
                        onClick={() => handleSave("published")}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        <Send size={18} />
                        Publish
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Article Title..." 
                    className="w-full text-4xl font-bold border-none outline-none bg-transparent placeholder-gray-300"
                />
            </div>

            {/* BlockNote Editor */}
            <Editor 
                initialContent={content} 
                onChange={(json) => setContent(json)} 
            />
        </div>
    );
}
