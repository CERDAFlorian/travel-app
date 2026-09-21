import { useEffect, useRef } from 'react';
import './ConfirmDialog.scss';

// Confirmation d'un geste destructeur.
//
// `<dialog>` natif plutôt qu'une div positionnée : le navigateur fournit le
// piège de focus, la fermeture par Échap, l'inertie de l'arrière-plan et le
// rôle ARIA. Les réimplémenter à la main, c'est trois bugs d'accessibilité
// garantis.
//
// Remplace la confirmation en deux temps qui s'armait sur le bouton lui-même.
// Elle avait un défaut : rien ne disait CE QU'ON SUPPRIME. « Confirmer ? » sur
// une ligne d'item ne rappelle pas que retirer une étape emporte aussi ses
// items et ses liaisons.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Supprimer',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm"
      // `cancel` couvre la touche Échap ; sans ce gestionnaire, le dialogue se
      // fermerait sans que React le sache et resterait « ouvert » en état.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      // Un clic sur le fond vise le <dialog> lui-même, jamais son contenu.
      onClick={(event) => {
        if (event.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="confirm__box">
        <h2 className="confirm__title">{title}</h2>
        <div className="confirm__body">{children}</div>

        <div className="confirm__actions">
          <button className="confirm__cancel" type="button" disabled={busy} onClick={onCancel}>
            Annuler
          </button>
          {/* autoFocus sur Annuler, pas sur la confirmation : une touche
              Entrée réflexe ne doit pas détruire quelque chose. */}
          <button className="confirm__go" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
