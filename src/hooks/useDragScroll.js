import { useEffect, useRef } from 'react';

// Glisser-déposer horizontal à la souris.
//
// POURQUOI CE HOOK EXISTE. Un conteneur en `overflow-x: auto` défile au doigt
// et à la molette horizontale d'un trackpad, mais PAS en glissant à la souris :
// ce geste n'existe pas nativement sur le web. Avec la barre de défilement
// masquée, un utilisateur à la souris n'avait plus aucun moyen de faire bouger
// la frise — elle paraissait figée.
//
// Le tactile n'est pas touché : il défile déjà, avec son inertie, et
// l'intercepter la supprimerait.
const SLOP_PX = 3;

export function useDragScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    let startX = 0;
    let startLeft = 0;
    let travelled = 0;
    let dragging = false;

    // Pas de setPointerCapture : la capture redirige l'événement `click` vers
    // l'élément capturant, et les segments ne recevraient plus rien. On écoute
    // donc la fenêtre, ce qui suffit à suivre le pointeur hors du cadre.
    function onPointerDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (element.scrollWidth <= element.clientWidth) return;

      dragging = true;
      travelled = 0;
      startX = event.clientX;
      startLeft = element.scrollLeft;
      element.dataset.dragging = '';
    }

    function onPointerMove(event) {
      if (!dragging) return;

      const dx = event.clientX - startX;
      travelled = Math.max(travelled, Math.abs(dx));
      element.scrollLeft = startLeft - dx;

      // Au-delà du seuil, on empêche la sélection de texte qui accompagnerait
      // le glisser et donnerait un surlignage bleu disgracieux.
      if (travelled > SLOP_PX) event.preventDefault();
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      delete element.dataset.dragging;

      // Un glisser ne doit pas sélectionner l'étape sous le curseur. On avale
      // le clic qui suit, une seule fois, en phase de capture — avant qu'il
      // n'atteigne le bouton.
      if (travelled > SLOP_PX) {
        element.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            event.stopPropagation();
          },
          { capture: true, once: true },
        );
      }
    }

    element.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return ref;
}
