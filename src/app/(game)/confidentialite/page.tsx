export const metadata = { title: 'Politique de confidentialité – VOID Pack' }

export default function Confidentialite() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-white/80 space-y-8">
      <h1 className="text-3xl font-extrabold text-white">Politique de confidentialité</h1>
      <p className="text-sm text-white/40">En vigueur au 1er août 2025 - conforme au RGPD</p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">1. Responsable du traitement</h2>
        <p>
          tsu_kuma - <a href="mailto:stud.void@gmail.com" className="text-purple-400 hover:underline">stud.void@gmail.com</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">2. Données collectées</h2>
        <p>Lors de la connexion via Twitch, nous collectons :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Identifiant Twitch (ID unique)</li>
          <li>Nom d'utilisateur Twitch (<em>login</em>)</li>
          <li>Photo de profil Twitch</li>
          <li>Adresse e-mail associée au compte Twitch (si autorisée)</li>
        </ul>
        <p className="mt-2">Ces données sont utilisées uniquement pour :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Créer et gérer votre compte sur VOID Pack</li>
          <li>Afficher votre profil et votre collection</li>
          <li>Vérifier le statut d'abonné Twitch pour les fonctionnalités réservées</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">3. Cookies et sessions</h2>
        <p>
          VOID Pack utilise un cookie de session sécurisé (HttpOnly) pour maintenir votre connexion. Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">4. Partage des données</h2>
        <p>Vos données ne sont <strong>jamais vendues ni cédées</strong> à des tiers. Elles peuvent être transmises à :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Twitch</strong> - pour l'authentification OAuth (traitement régi par leur politique de confidentialité)</li>
          <li><strong>Netlify</strong> - hébergeur du site (données transitent par leurs serveurs)</li>
          <li><strong>Turso</strong> - base de données hébergée (stockage des profils et collections)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">5. Durée de conservation</h2>
        <p>
          Vos données sont conservées tant que votre compte est actif. Vous pouvez supprimer votre compte à tout moment depuis votre profil, toutes vos données sont alors effacées immédiatement et définitivement. En cas d'inactivité prolongée (plus de 2 ans), elles sont effacées dans un délai de 30 jours.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">6. Vos droits (RGPD)</h2>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Accès</strong> : obtenir une copie de vos données</li>
          <li><strong>Rectification</strong> : corriger des données inexactes</li>
          <li><strong>Effacement</strong> : demander la suppression de votre compte</li>
          <li><strong>Opposition</strong> : vous opposer à un traitement</li>
          <li><strong>Portabilité</strong> : recevoir vos données dans un format lisible</li>
        </ul>
        <p className="mt-2">
          Pour exercer ces droits, contactez :{' '}
          <a href="mailto:stud.void@gmail.com" className="text-purple-400 hover:underline">stud.void@gmail.com</a>.
          Vous pouvez également introduire une réclamation auprès de la{' '}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">CNIL</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">7. Sécurité</h2>
        <p>
          Les données sont transmises via HTTPS. Les tokens de session sont chiffrés. L'accès à la base de données est restreint et protégé par des tokens d'authentification.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">8. Modification de la politique</h2>
        <p>
          Cette politique peut être mise à jour. La date de dernière modification est indiquée en bas de page. Toute modification significative sera notifiée via le site.
        </p>
      </section>

      <p className="text-sm text-white/30">Dernière mise à jour : août 2025</p>
    </div>
  )
}
