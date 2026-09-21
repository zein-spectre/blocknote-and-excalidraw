import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { databases, APPWRITE_CONFIG, ID } from "../lib/appwrite";
import { Plus, Edit, Eye, Trash2, ArchiveRestore } from "lucide-react";
import { Query } from "appwrite";

export function AdminDashboard() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            const [articlesRes, canvasesRes] = await Promise.all([
                databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collectionId,
                    [Query.notEqual("status", "trashed")]
                ),
                databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    "canvases",
                    []
                )
            ]);

            const articles = articlesRes.documents.map(d => ({ ...d, format: "BLOCKNOTE" }));
            const canvases = canvasesRes.documents
                .filter(d => d.status !== "trashed")
                .map(d => ({ ...d, format: "CANVAS", status: d.status || "draft" }));

            const combined = [...articles, ...canvases].sort(
                (a, b) => new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
            );

            setItems(combined);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const deleteItem = async (id: string, format: string) => {
        if (!window.confirm(`Are you sure you want to move this ${format.toLowerCase()} to trash?`)) return;
        try {
            const collectionId = format === "CANVAS" ? "canvases" : APPWRITE_CONFIG.collectionId;
            await databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                collectionId,
                id,
                { status: "trashed" }
            );
            fetchData();
        } catch (error) {
            console.error("Failed to move item to trash:", error);
        }
    };

    const handleNewCanvas = async () => {
        try {
            const newDoc = await databases.createDocument(
                APPWRITE_CONFIG.databaseId,
                "canvases",
                ID.unique(),
                { title: "(Tanpa judul)", scene: "[]", status: "draft" }
            );
            navigate(`/canvas/${newDoc.$id}`);
        } catch (error) {
            console.error("Gagal membuat kanvas baru:", error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading articles...</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <div className="flex gap-4">
                    <Link 
                        to="/admin/trash" 
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                    >
                        <ArchiveRestore size={20} />
                        Tong Sampah
                    </Link>
                    <button 
                        onClick={handleNewCanvas}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                        <Plus size={20} />
                        New Canvas
                    </button>
                    <Link 
                        to="/admin/edit/new" 
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={20} />
                        New Article
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No items found. Create one!</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 font-semibold text-gray-600">Title</th>
                                <th className="p-4 font-semibold text-gray-600">Format</th>
                                <th className="p-4 font-semibold text-gray-600">Status</th>
                                <th className="p-4 font-semibold text-gray-600">Last Updated</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((doc) => (
                                <tr key={doc.$id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                    <td className="p-4 font-medium text-gray-900">{doc.title || "Untitled"}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${
                                            doc.format === 'CANVAS'
                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {doc.format}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            doc.status === 'published' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {(doc.status || "draft").toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {new Date(doc.$updatedAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 flex justify-end gap-3">
                                        <Link to={doc.format === 'CANVAS' ? `/canvas/${doc.$id}` : `/admin/edit/${doc.$id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                                            <Edit size={18} />
                                        </Link>
                                        {doc.format === 'CANVAS' ? (
                                            <Link to={`/view/canvas/${doc.$id}`} target="_blank" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Preview Canvas">
                                                <Eye size={18} />
                                            </Link>
                                        ) : (
                                            <Link to={`/article/${doc.$id}`} target="_blank" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Preview Note">
                                                <Eye size={18} />
                                            </Link>
                                        )}
                                        <button onClick={() => deleteItem(doc.$id, doc.format)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                            <Trash2 size={18} />
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
