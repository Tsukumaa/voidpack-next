export const metadata = { title: 'Mentions légales – VOID Pack' }

export default function MentionsLegales() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-white/80 space-y-8">
      <h1 className="text-3xl font-extrabold text-white">Mentions légales</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Éditeur du site</h2>
        <p>Le site <strong>void-pack.fr</strong> est édité par :</p>
        <ul className="list-none space-y-1 pl-0">
          <li><span className="text-white/50">Pseudo :</span> tsu_kuma</li>
          <li><span className="text-white/50">Statut :</span> Site édité à titre non professionnel.</li>
          <li><span className="text-white/50">Contact :</span>{' '}
            <a href="mailto:stud.void@gmail.com" className="text-purple-400 hover:underline">stud.void@gmail.com</a>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Hébergeur</h2>
        <ul className="list-none space-y-1">
          <li><span className="text-white/50">Société :</span> Netlify Inc.</li>
          <li><span className="text-white/50">Adresse :</span> 2325 3rd Street, Suite 215, San Francisco, California 94107, Etats-Unis</li>
          <li><span className="text-white/50">Site :</span>{' '}
            <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">www.netlify.com</a>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus présents sur VOID Pack (illustrations, cartes, textes, interface) sont la propriété de l'éditeur ou de leurs auteurs respectifs et sont protégés par le droit d'auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Liens externes</h2>
        <p>
          VOID Pack peut contenir des liens vers des sites tiers (Twitch, Ko-fi…). L'éditeur ne saurait être tenu responsable du contenu de ces sites.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Droit applicable</h2>
        <p>Les présentes mentions légales sont soumises au droit français. Tout litige relève de la compétence des tribunaux français.</p>
      </section>

      <p className="text-sm text-white/30">Dernière mise à jour : août 2025</p>
    </div>
  )
}
