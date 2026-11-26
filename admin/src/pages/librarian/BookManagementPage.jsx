import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  Layers,
  Barcode,
  X,
  MapPin,
  CheckCircle2,
  Tag,
  FileText,
} from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../../components/common/StatusBadge";
import { showToast } from "../../components/common/Toast";

export default function BookManagementPage() {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal Doc Add / Edit
  const [showDocModal, setShowDocModal] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    titre: "",
    auteur: "",
    categorie: "Informatique & Génie Logiciel",
    couleur: "#101B33",
    isbn: "",
    editeur: "IUA Presses",
    annee: 2024,
    langue: "Français",
    cote: "",
    localisation: "Rayon B — Étagère 4",
    resume: "",
    mots_cles: "",
    type_document: "livre",
    nb_pages: 300,
    nb_exemplaires: 2,
    disponible: 1,
  });

  // Modal Manage Copies (Exemplaires)
  const [copiesModalDoc, setCopiesModalDoc] = useState(null); // Selected document
  const [docCopies, setDocCopies] = useState([]);
  const [newCopyState, setNewCopyState] = useState("neuf");

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const [docs, cats] = await Promise.all([
        api.getDocuments(),
        api.getTaxonomies("categories").catch(() => []),
      ]);
      setDocuments(Array.isArray(docs) ? docs : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      showToast("Erreur de chargement des documents", "error");
    } finally {
      setLoading(false);
    }
  };

  const openDocModal = (doc = null) => {
    if (doc) {
      setFormData({
        id: doc.id,
        titre: doc.titre,
        auteur: doc.auteur,
        categorie: doc.categorie || "Informatique & Génie Logiciel",
        couleur: doc.couleur || "#101B33",
        isbn: doc.isbn || "",
        editeur: doc.editeur || "",
        annee: doc.annee || 2024,
        langue: doc.langue || "Français",
        cote: doc.cote || "",
        localisation: doc.localisation || "Rayon B — Étagère 4",
        resume: doc.resume || "",
        mots_cles: doc.mots_cles || "",
        type_document: doc.type_document || "livre",
        nb_pages: doc.nb_pages || 300,
        nb_exemplaires: 1,
        disponible: doc.disponible ?? 1,
      });
    } else {
      setFormData({
        id: null,
        titre: "",
        auteur: "",
        categorie: categories[0]?.nom || "Informatique & Génie Logiciel",
        couleur: "#101B33",
        isbn: "",
        editeur: "Édition Universitaire",
        annee: 2024,
        langue: "Français",
        cote: "ROM-01",
        localisation: "Rayon B — Étagère 4",
        resume: "",
        mots_cles: "",
        type_document: "livre",
        nb_pages: 320,
        nb_exemplaires: 2,
        disponible: 1,
      });
    }
    setShowDocModal(true);
  };

  const handleSaveDoc = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.updateDocument(formData);
        showToast("Document modifié avec succès !", "success");
      } else {
        await api.createDocument(formData);
        showToast("Nouveau document et ses exemplaires créés !", "success");
      }
      setShowDocModal(false);
      loadDocs();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDeleteDoc = async (id) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cet ouvrage et tous ses exemplaires ?"))
      return;
    try {
      await api.deleteDocument(id);
      showToast("Document supprimé avec succès.", "info");
      loadDocs();
    } catch (err) {
      showToast(err.message || "Erreur lors de la suppression", "error");
    }
  };

  // Manage Copies methods
  const openCopiesModal = async (doc) => {
    setCopiesModalDoc(doc);
    try {
      const copies = await api.getCopiesByDocument(doc.id);
      setDocCopies(Array.isArray(copies) ? copies : []);
    } catch (e) {
      showToast("Erreur lors de la récupération des exemplaires", "error");
    }
  };

  const handleAddCopy = async () => {
    if (!copiesModalDoc) return;
    try {
      await api.createCopy({
        document_id: copiesModalDoc.id,
        etat: newCopyState,
        statut: "disponible",
      });
      showToast("Nouvel exemplaire physique ajouté avec succès !", "success");
      const updated = await api.getCopiesByDocument(copiesModalDoc.id);
      setDocCopies(updated);
      loadDocs();
    } catch (err) {
      showToast(err.message || "Erreur", "error");
    }
  };

  const handleUpdateCopyStatus = async (copyId, newStatut, newEtat) => {
    try {
      await api.updateCopy({ id: copyId, statut: newStatut, etat: newEtat });
      showToast("Statut de l'exemplaire mis à jour", "success");
      const updated = await api.getCopiesByDocument(copiesModalDoc.id);
      setDocCopies(updated);
      loadDocs();
    } catch (err) {
      showToast(err.message || "Erreur", "error");
    }
  };

  const handleDeleteCopy = async (copyId) => {
    if (!confirm("Supprimer cet exemplaire ?")) return;
    try {
      await api.deleteCopy(copyId);
      showToast("Exemplaire supprimé", "info");
      const updated = await api.getCopiesByDocument(copiesModalDoc.id);
      setDocCopies(updated);
      loadDocs();
    } catch (e) {
      showToast("Erreur", "error");
    }
  };

  const filtered = documents.filter((d) => {
    return (
      (d.titre + " " + d.auteur + " " + (d.isbn || "") + " " + (d.cote || "") + " " + d.categorie)
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
            Gestion du Catalogue & Exemplaires
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enregistrez les notices documentaires, gérez les cotes et suivez l'état physique de chaque exemplaire.
          </p>
        </div>
        <button
          onClick={() => openDocModal()}
          className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus size={16} /> Ajouter un document
        </button>
      </div>

      {/* Search and Table */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-navy-700 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, auteur, ISBN, cote..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-xs text-navy-800 dark:text-white outline-none"
            />
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {filtered.length} document(s) répertorié(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Titre & Auteur</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4">Cote / Rayon</th>
                <th className="px-6 py-4">Exemplaires</th>
                <th className="px-6 py-4">Disponibilité</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-navy-800 dark:text-white text-sm">{d.titre}</p>
                    <p className="text-[11px] text-gray-400">
                      {d.auteur} {d.annee ? `• ${d.annee}` : ""} {d.isbn ? `• ISBN: ${d.isbn}` : ""}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 font-medium text-[11px]">
                      {d.categorie}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-navy-800 dark:text-white block">
                      {d.cote || "ROM-01"}
                    </span>
                    <span className="text-[10px] text-gray-400 block truncate max-w-[160px]">
                      {d.localisation || "Section Centrale"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openCopiesModal(d)}
                      className="px-3 py-1.5 rounded-xl bg-sky-pale dark:bg-navy-700 text-sky-deep dark:text-sky-brand font-bold text-xs hover:bg-sky-100 flex items-center gap-1.5 transition-colors"
                      title="Gérer les exemplaires physiques de cet ouvrage"
                    >
                      <Layers size={14} />
                      <span>{d.copies_disponibles || 0} / {d.total_copies || 1} dispo</span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={d.disponible == 1 || (d.copies_disponibles > 0) ? "disponible" : "emprunte"} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openDocModal(d)}
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-navy-700 transition-colors"
                        title="Modifier la notice"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(d.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-navy-700 transition-colors"
                        title="Supprimer l'ouvrage"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              Aucun document trouvé.
            </div>
          )}
        </div>
      </div>

      {/* Modal Add / Edit Document */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-4">
              <h2 className="font-display text-xl font-bold text-navy-800 dark:text-white">
                {formData.id ? "Modifier la Notice Documentaire" : "Créer un Nouvel Ouvrage au Catalogue"}
              </h2>
              <button onClick={() => setShowDocModal(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Titre de l'ouvrage *</label>
                  <input
                    type="text"
                    required
                    value={formData.titre}
                    onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Auteur principal *</label>
                  <input
                    type="text"
                    required
                    value={formData.auteur}
                    onChange={(e) => setFormData({ ...formData, auteur: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Catégorie *</label>
                  <input
                    type="text"
                    required
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                    placeholder="Ex: Informatique, Droit, Roman..."
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Cote SIGB</label>
                  <input
                    type="text"
                    value={formData.cote}
                    onChange={(e) => setFormData({ ...formData, cote: e.target.value })}
                    placeholder="Ex: INF-GL-01"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Code ISBN</label>
                  <input
                    type="text"
                    value={formData.isbn}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    placeholder="978-..."
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Éditeur</label>
                  <input
                    type="text"
                    value={formData.editeur}
                    onChange={(e) => setFormData({ ...formData, editeur: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Année d'édition</label>
                  <input
                    type="number"
                    value={formData.annee}
                    onChange={(e) => setFormData({ ...formData, annee: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Localisation (Rayon / Étagère)</label>
                  <input
                    type="text"
                    value={formData.localisation}
                    onChange={(e) => setFormData({ ...formData, localisation: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Couleur de tranche</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.couleur}
                      onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-xs">{formData.couleur}</span>
                  </div>
                </div>
                {!formData.id && (
                  <div>
                    <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      Exemplaires initiaux à créer
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={formData.nb_exemplaires}
                      onChange={(e) => setFormData({ ...formData, nb_exemplaires: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Type de document</label>
                  <select
                    value={formData.type_document}
                    onChange={(e) => setFormData({ ...formData, type_document: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  >
                    <option value="livre">Livre / Manuel</option>
                    <option value="memoire">Mémoire</option>
                    <option value="these">Thèse</option>
                    <option value="revue">Revue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Résumé complet</label>
                <textarea
                  rows="3"
                  value={formData.resume}
                  onChange={(e) => setFormData({ ...formData, resume: e.target.value })}
                  placeholder="Présentation synthétique de l'ouvrage..."
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">Mots-clés (séparés par des virgules)</label>
                <input
                  type="text"
                  value={formData.mots_cles}
                  onChange={(e) => setFormData({ ...formData, mots_cles: e.target.value })}
                  placeholder="génie logiciel, architecture, react..."
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-sky-brand hover:bg-sky-deep text-white shadow-md transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Manage Copies (Exemplaires multiples) */}
      {copiesModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-4">
              <div>
                <h3 className="font-display text-xl font-bold text-navy-800 dark:text-white">
                  Exemplaires Physiques — {copiesModalDoc.titre}
                </h3>
                <p className="text-xs text-gray-500">
                  Auteur : {copiesModalDoc.auteur} • Cote : {copiesModalDoc.cote || "ROM"}
                </p>
              </div>
              <button onClick={() => setCopiesModalDoc(null)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Add New Copy form */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700/60 flex items-center justify-between gap-4 flex-wrap text-xs">
              <span className="font-bold text-navy-800 dark:text-white">
                Ajouter un nouvel exemplaire physique :
              </span>
              <div className="flex items-center gap-3">
                <select
                  value={newCopyState}
                  onChange={(e) => setNewCopyState(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 outline-none"
                >
                  <option value="neuf">État : Neuf</option>
                  <option value="bon">État : Bon</option>
                  <option value="moyen">État : Moyen</option>
                  <option value="abime">État : Abîmé</option>
                </select>
                <button
                  onClick={handleAddCopy}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm"
                >
                  + Ajouter exemplaire
                </button>
              </div>
            </div>

            {/* Copies list */}
            <div className="rounded-2xl border border-gray-200 dark:border-navy-700 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
                  <tr>
                    <th className="px-4 py-3">N° Ex.</th>
                    <th className="px-4 py-3">Code-barre</th>
                    <th className="px-4 py-3">État physique</th>
                    <th className="px-4 py-3">Statut actuel</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-700 text-gray-600 dark:text-gray-300">
                  {docCopies.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-bold text-navy-800 dark:text-white">
                        Exemplaire #{c.numero_exemplaire}
                      </td>
                      <td className="px-4 py-3 font-mono text-sky-deep dark:text-sky-brand">
                        {c.code_barre}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.etat}
                          onChange={(e) => handleUpdateCopyStatus(c.id, c.statut, e.target.value)}
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700"
                        >
                          <option value="neuf">Neuf</option>
                          <option value="bon">Bon</option>
                          <option value="moyen">Moyen</option>
                          <option value="abime">Abîmé</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.statut}
                          onChange={(e) => handleUpdateCopyStatus(c.id, e.target.value, c.etat)}
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700"
                        >
                          <option value="disponible">Disponible</option>
                          <option value="emprunte">Emprunté</option>
                          <option value="reserve">Réservé</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="perdu">Perdu</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteCopy(c.id)}
                          className="p-1 text-rose-500 hover:text-rose-700"
                          title="Supprimer cet exemplaire"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {docCopies.length === 0 && (
                <div className="p-6 text-center text-xs text-gray-500">
                  Aucun exemplaire physique renseigné pour ce titre.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCopiesModalDoc(null)}
                className="px-5 py-2 rounded-xl bg-gray-100 dark:bg-navy-700 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
