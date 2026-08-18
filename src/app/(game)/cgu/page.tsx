export const metadata = { title: 'CGU – VOID Pack' }

export default function CGU() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-white/80 space-y-8">
      <h1 className="text-3xl font-extrabold text-white">Conditions Générales d'Utilisation</h1>
      <p className="text-sm text-white/40">En vigueur au 1er août 2025</p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">1. Présentation</h2>
        <p>
          VOID Pack est une plateforme de jeu en ligne permettant l'ouverture de boosters de cartes virtuelles, la constitution d'une collection et l'échange entre joueurs. L'accès au site est gratuit. Certaines fonctionnalités peuvent nécessiter un compte Twitch.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">2. Accès et inscription</h2>
        <p>
          L'utilisation du site est ouverte à toute personne disposant d'un compte Twitch. En vous connectant, vous acceptez les présentes CGU ainsi que les{' '}
          <a href="https://www.twitch.tv/p/fr-fr/legal/terms-of-service/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Conditions d'utilisation de Twitch</a>.
        </p>
        <p>Vous devez être âgé d'au moins 13 ans pour utiliser le service, conformément aux conditions de Twitch.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">3. Règles d'utilisation</h2>
        <p>Il est interdit de :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Exploiter des failles ou bugs à des fins frauduleuses</li>
          <li>Utiliser des bots, scripts ou outils automatisés</li>
          <li>Partager des contenus illicites, haineux ou trompeurs</li>
          <li>Tenter d'accéder à des données appartenant à d'autres utilisateurs</li>
          <li>Revendre ou monétiser les éléments du jeu sans autorisation</li>
        </ul>
        <p>Le non-respect de ces règles peut entraîner la suspension ou la suppression du compte sans préavis.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">4. Contenu et cartes virtuelles</h2>
        <p>
          Les cartes, boosters et éléments de collection sont des biens virtuels sans valeur monétaire réelle. Ils ne peuvent pas être échangés contre de l'argent et n'ont aucune valeur marchande garantie. L'éditeur se réserve le droit de modifier, rééquilibrer ou retirer des cartes à tout moment.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">5. Soutien (Ko-fi)</h2>
        <p>
          Le site propose un moyen de soutien volontaire via Ko-fi. Ces contributions sont traitées comme des dons sans contrepartie garantie. Elles ne donnent pas droit à un remboursement sauf disposition légale contraire.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">6. Disponibilité du service</h2>
        <p>
          L'éditeur s'efforce de maintenir le service accessible en permanence mais ne garantit pas une disponibilité sans interruption. Des maintenances peuvent être effectuées sans préavis. L'éditeur ne saurait être tenu responsable de toute perte de données liée à une interruption de service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">7. Modification des CGU</h2>
        <p>
          L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés via le site. La poursuite de l'utilisation du service après modification vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">8. Droit applicable</h2>
        <p>Les présentes CGU sont régies par le droit français.</p>
      </section>

      <p className="text-sm text-white/30">Dernière mise à jour : août 2025</p>
    </div>
  )
}
