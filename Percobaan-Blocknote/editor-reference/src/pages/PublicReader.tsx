import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Editor } from "../components/Editor";
import { databases, APPWRITE_CONFIG } from "../lib/appwrite";

export function PublicReader() {
    const { id } = useParams();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (id) {
            databases.getDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                id
            ).then((doc) => {
                if (doc.status !== "published") {
                    setError("This article is not available to the public.");
                } else {
                    setTitle(doc.title);
                    setContent(doc.content);
                }
                setLoading(false);
            }).catch((err) => {
                console.error("Failed to load article:", err);
                setError("Article not found.");
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading article...</div>;
    
    if (error) return (
        <div className="p-8 text-center mt-20">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
            <Link to="/admin" className="text-blue-600 hover:underline">Go to Admin Dashboard</Link>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto p-6 md:p-10 bg-white min-h-screen shadow-sm mt-8 mb-12 rounded-xl border border-gray-100">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-8 pb-6 border-b border-gray-100">{title}</h1>
            {/* Editor in read-only mode to render the content natively */}
            <div className="prose max-w-none">
                <Editor initialContent={content} editable={false} />
            </div>
        </div>
    );
}
