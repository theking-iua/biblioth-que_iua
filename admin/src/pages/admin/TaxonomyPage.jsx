import React, { useState, useEffect } from "react";
import { Layers, Plus, Edit, Trash2, X, MapPin, BookOpen, Users, Bookmark } from "lucide-react";
import api from "../../services/api";
import { showToast } from "../../components/common/Toast";

export default function TaxonomyPage() {
  const [currentTab, setCurrentTab] = useState("categories"); // 'categories', 'authors', 'publishers', 'locations'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: null, nom: "", code: "", description: "", ville: "", salle: "", rayon: "" });

  useEffect(() => {
    loadTaxonomies();
  }, [currentTab]);

  const loadTaxonomies = async () => {
    setLoading(true);
    try {
      const data = await api.getTaxonomies(currentTab);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Erreur lors du chargement des données", "error");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setFormData({
        id: item.id,
        nom: item.nom,
        code: item.code || "",
        description: item.description || item.biographie || "",
        ville: item.ville || "",
        salle: item.salle || "",
        rayon: item.rayon || "",
      });
    } else {
      setFormData({
        id: null,
        nom: "",
        code: "",
        description: "",
        ville: "",
        salle: "",
        rayon: "",
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.updateTaxonomy(currentTab, formData);
        showToast("Élément modifié avec succès !", "success");
      } else {
        await api.createTaxonomy(currentTab, formData);
        showToast("Élément ajouté avec succès !", "success");
      }
      setShowModal(false);
      loadTaxonomies();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cet élément ?")) return;
    try {
      await api.deleteTaxonomy(currentTab, id);
      showToast("Élément supprimé", "info");
      loadTaxonomies();
    } catch (err) {
      showToast(err.message || "Erreur", "error");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
            Référentiels & Taxonomies SIGB
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gérez dynamiquement les catégories documentaires, les auteurs, les éditeurs et les emplacements de rayonnage.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus size={16} /> Ajouter ({currentTab})
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-navy-700 pb-3 text-xs">
        {[
          { id: "categories", label: "Catégories Thématiques", icon: Layers },
          { id: "authors", label: "Auteurs", icon: Users },
          { id: "publishers", label: "Maisons d'Édition", icon: BookOpen },
          { id: "locations", label: "Rayons & Emplacements", icon: MapPin },
        ].map((t) => {
          const Icon = t.icon;
          const active = currentTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setCurrentTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
                active
                  ? "bg-navy-800 dark:bg-sky-brand text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-700"
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
            <tr>
              <th className="px-6 py-4">Nom / Intitulé</th>
              <th className="px-6 py-4">Détails / Code</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                <td className="px-6 py-4 font-bold text-navy-800 dark:text-white text-sm">
                  {it.nom}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {it.code && <span className="font-mono bg-gray-100 dark:bg-navy-700 px-2 py-0.5 rounded mr-2">{it.code}</span>}
                  {it.description || it.biographie || it.ville || it.salle || "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openModal(it)}
                      className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-navy-700"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(it.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-navy-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="p-12 text-center text-xs text-gray-500">
            Aucun élément répertorié.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-3">
              <h3 className="font-display text-lg font-bold text-navy-800 dark:text-white">
                {formData.id ? "Modifier l'élément" : "Ajouter un élément"} ({currentTab})
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nom / Désignation *</label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              {currentTab === "categories" && (
                <>
                  <div>
                    <label className="block font-semibold mb-1">Code abrégé</label>
                    <input
                      type="text"
                      placeholder="Ex: INFO-GL"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Description</label>
                    <textarea
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                    ></textarea>
                  </div>
                </>
              )}

              {currentTab === "locations" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Salle / Étage</label>
                    <input
                      type="text"
                      placeholder="Salle A"
                      value={formData.salle}
                      onChange={(e) => setFormData({ ...formData, salle: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Rayon / Étagère</label>
                    <input
                      type="text"
                      placeholder="Rayon 3"
                      value={formData.rayon}
                      onChange={(e) => setFormData({ ...formData, rayon: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 bg-gray-100 dark:bg-navy-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-brand hover:bg-sky-deep text-white font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
