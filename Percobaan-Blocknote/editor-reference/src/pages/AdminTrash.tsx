import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { databases, APPWRITE_CONFIG } from "../lib/appwrite";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Query } from "appwrite";

export function AdminTrash() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTrashedData = async () => {
        try {
            const [articlesRes, canvasesRes] = await Promise.all([
                databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    [Query.equal("status", "trashed")]
                ),
                databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    "canvases",
                    []
                )
            ]);

            const articles = articlesRes.documents.map(d => ({ ...d, format: "BLOCKNOTE" }));
            const canvases = canvasesRes.documents
                .filter(d => d.status === "trashed")
                .map(d => ({ ...d, format: "CANVAS" }));

            const combined = [...articles, ...canvases].sort(
                (a, b) => new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
            );

            setItems(combined);
        } catch (error) {
            console.error("Failed to fetch trashed data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrashedData();
    }, []);

    const restoreItem = async (id: string, format: string) => {
        try {
            const collectionId = format === "CANVAS" ? "canvases" : APPWRITE_CONFIG.collectionId;
            await databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                collectionId,
                id,
                { status: "draft" }
            );
            fetchTrashedData();
        } catch (error) {
            console.error("Failed to restore item:", error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading trash...</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex flex-col mb-8">
                <Link to="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 w-fit">
                    <ArrowLeft size={20} />
                    Kembali ke Dashboard
                </Link>
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tong Sampah</h1>
                        <p className="text-sm text-amber-600 font-medium">
                            Hapus permanen dilakukan manual di Appwrite
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Tong sampah kosong.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 font-semibold text-gray-600">Title</th>
                                <th className="p-4 font-semibold text-gray-600">Format</th>
                                <th className="p-4 font-semibold text-gray-600">Deleted At (Updated)</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((doc) => (
                                <tr key={doc.$id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                    <td className="p-4 font-medium text-gray-900 line-through opacity-70">
                                        {doc.title || "Untitled"}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${
                                            doc.format === 'CANVAS'
                                                ? 'bg-purple-50 text-purple-700 border-purple-200 opacity-70'
                                                : 'bg-blue-50 text-blue-700 border-blue-200 opacity-70'
                                        }`}>
                                            {doc.format}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {new Date(doc.$updatedAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 flex justify-end gap-3">
                                        <button 
                                            onClick={() => restoreItem(doc.$id, doc.format)} 
                                            className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition text-sm font-medium"
                                        >
                                            <RefreshCw size={16} />
                                            Pulihkan
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
