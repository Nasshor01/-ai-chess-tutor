import { PIECE_SET_CREDIT } from '../chess/pieceSet'
import { Modal } from './Modal'
import './AboutDialog.css'

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="O aplikaci"
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Zavřít
        </button>
      }
    >
      <div className="about">
        <p>Šachový trenér v prohlížeči. Partie, rozbor i nastavení zůstávají v tomto zařízení.</p>
        <h3>Figury</h3>
        <p>
          Autor kreseb: {PIECE_SET_CREDIT.author}. {PIECE_SET_CREDIT.source}. Obrys je jen tenká kontura samotné kresby,
          ne vlastní silný rámeček.
        </p>
        <p>
          Licence kreseb:{' '}
          <a href={PIECE_SET_CREDIT.licenseUrl} target="_blank" rel="noreferrer">
            Creative Commons Uveďte autora – Zachovejte licenci 3.0 ({PIECE_SET_CREDIT.license})
          </a>
          . Kresby lze šířit spolu s webovou aplikací, pokud zůstane uvedený autor a licence. Úprava kreseb by musela
          zůstat pod stejnou licencí. Ostatní text a kód aplikace se touto licencí neřídí.
        </p>
      </div>
    </Modal>
  )
}
