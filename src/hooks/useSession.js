import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.js';

// État d'authentification, et rien d'autre.
//
// Ce hook ne décide JAMAIS de ce qui s'affiche. Il dit qui est connecté ; le
// rendu du voyage se fera depuis le cache IndexedDB (L2), indépendamment.
// La raison est concrète : le jeton expire en ~1 h et son renouvellement passe
// par le réseau. Hors ligne au Japon, `session` peut très bien être null alors
// que la donnée est là, complète, dans le cache. Gater l'affichage là-dessus
// rendrait l'app inutilisable exactement quand elle sert.
//
// Conséquence : la session conditionne l'écriture et le fetch réseau. Pas
// l'affichage.

// Les messages de supabase-js sont en anglais et parfois cryptiques. On traduit
// les cas qu'on peut réellement rencontrer à deux utilisateurs connus, et on
// laisse passer le reste tel quel plutôt que d'avaler une cause inconnue.
function messageFor(error) {
  const raw = error?.message ?? '';

  if (/invalid login credentials/i.test(raw)) {
    return 'Email ou mot de passe incorrect.';
  }
  if (/email not confirmed/i.test(raw)) {
    return "Ce compte n'est pas confirmé. Valide l'invitation reçue par mail, ou coche « Auto Confirm User » dans le dashboard Supabase.";
  }
  if (/failed to fetch|network/i.test(raw)) {
    return 'Pas de réseau : la connexion à Supabase est impossible.';
  }
  return raw || 'Connexion impossible.';
}

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // Lecture du jeton stocké. Hors ligne avec un jeton périmé, supabase-js
    // tente un rafraîchissement qui échoue : on récupère null sans exception,
    // et c'est un état normal, pas une erreur à afficher.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session ?? null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // Couvre la connexion, la déconnexion et les rafraîchissements de jeton,
    // y compris ceux déclenchés dans un autre onglet.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    // onAuthStateChange pose la session ; on ne la duplique pas ici.
    return error ? { error: messageFor(error) } : { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, user: session?.user ?? null, loading, signIn, signOut };
}
