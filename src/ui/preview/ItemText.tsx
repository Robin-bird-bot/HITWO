/**
 * A line of text whose item names open the item's card when clicked (or
 * hovered a moment, or long-pressed). The card shows its Quality ranges,
 * since a name has no Quality of its own.
 */
import { usePreview } from './preview';
import { splitItemNames } from './itemNames';
import styles from './ItemText.module.css';

export function ItemText({ text }: { text: string }) {
  return (
    <>
      {splitItemNames(text).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <ItemName key={i} itemId={part.itemId} name={part.name} />
        ),
      )}
    </>
  );
}

function ItemName({ itemId, name }: { itemId: string; name: string }) {
  const preview = usePreview({ kind: 'item', itemId, unrolled: true }, { clickOpens: true });
  return (
    <button type="button" className={styles.name} {...preview}>
      {name}
    </button>
  );
}
