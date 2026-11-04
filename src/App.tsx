import { useHash } from './ui/app/useHash';
import { DebugMap } from './ui/debug/DebugMap';
import { Stage } from './ui/stage/Stage';
import { TitleScreen } from './ui/title/TitleScreen';

export function App() {
  const hash = useHash();
  if (hash.startsWith('#debug-map')) return <DebugMap hash={hash} />;
  return (
    <Stage>
      <TitleScreen />
    </Stage>
  );
}
