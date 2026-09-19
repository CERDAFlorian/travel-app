import { useState } from 'react';
import './Login.scss';

// Écran de connexion — email + mot de passe.
//
// Pas de magic link : le SMTP par défaut de Supabase est plafonné et n'envoie
// qu'aux adresses de l'équipe du projet, et recevoir un mail suppose un réseau
// et une boîte accessible depuis le téléphone, à l'étranger. Les deux comptes
// sont créés à la main dans le dashboard.
//
// Pas d'inscription non plus, pour la même raison : l'app a deux utilisateurs
// connus. Un formulaire de création de compte ouvrirait la porte à n'importe
// qui, sans rien apporter.
export default function Login({ onSignIn, onDismiss }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    const { error: failure } = await onSignIn(email, password);

    // En cas de succès, la session change et ce composant est démonté : pas de
    // setState à faire, il déclencherait un avertissement React.
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">Itinéraire</p>
        <h1 className="login__title">Connexion</h1>
        <p className="login__intro">
          Les comptes sont créés à la main. Une fois connecté, tu le restes :
          l'app se rouvre sans redemander le mot de passe.
        </p>

        <label className="login__field">
          <span className="login__label">Email</span>
          <input
            className="login__input"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </label>

        <label className="login__field">
          <span className="login__label">Mot de passe</span>
          <input
            className="login__input"
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {/* aria-live : sans ça, un lecteur d'écran ne signale jamais l'échec,
            le focus restant sur le bouton. */}
        <p className="login__error" role="alert" aria-live="polite">
          {error}
        </p>

        <button className="login__submit" type="submit" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>

        {/* Présent seulement quand il y a du cache à lire. Se connecter ne doit
            jamais être un passage obligé : hors ligne, le formulaire ne peut
            pas aboutir, et rester coincé devant serait le pire des scénarios. */}
        {onDismiss && (
          <button className="login__dismiss" type="button" onClick={onDismiss}>
            Continuer sans me connecter
          </button>
        )}
      </form>
    </main>
  );
}
