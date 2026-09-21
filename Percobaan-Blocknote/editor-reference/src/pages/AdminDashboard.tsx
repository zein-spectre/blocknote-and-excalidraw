import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { databases, APPWRITE_CONFIG } from "../lib/appwrite";
import { Plus, Edit, Eye, Trash2 } from "lucide-react";

export function AdminDashboard() {
    const [articles, setArticles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchArticles = async () => {
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId
            );
            setArticles(response.documents);
        } catch (error) {
            console.error("Failed to fetch articles:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, []);

    const deleteArticle = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this article?")) return;
        try {
            await databases.deleteDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collectionId,
                id
            );
            fetchArticles();
        } catch (error) {
            console.error("Failed to delete article:", error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading articles...</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <Link 
                    to="/admin/edit/new" 
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={20} />
                    New Article
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {articles.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No articles found. Create one!</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-4 font-semibold text-gray-600">Title</th>
                                <th className="p-4 font-semibold text-gray-600">Status</th>
                                <th className="p-4 font-semibold text-gray-600">Last Updated</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {articles.map((doc) => (
                                <tr key={doc.$id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                    <td className="p-4 font-medium text-gray-900">{doc.title || "Untitled"}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            doc.status === 'published' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {doc.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {new Date(doc.$updatedAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 flex justify-end gap-3">
                                        <Link to={`/admin/edit/${doc.$id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                                            <Edit size={18} />
                                        </Link>
                                        <Link to={`/article/${doc.$id}`} target="_blank" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="View Public">
                                            <Eye size={18} />
                                        </Link>
                                        <button onClick={() => deleteArticle(doc.$id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
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
