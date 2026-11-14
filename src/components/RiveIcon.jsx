// Rive 3D 아이콘. public/assets/rive/<name>.riv 를 재생하고, 못 불러오면 fallback(framer-motion 아이콘)을 보여줌.
// icons.jsx에서 lazy로 불러와서, Rive 아이콘이 없는 화면은 런타임을 받지 않음.
import { useState } from 'react';
import { RuntimeLoader, useRive } from '@rive-app/react-canvas';
import riveWasm from '@rive-app/canvas/rive.wasm?url';

// 기본값은 실행할 때 unpkg CDN에서 wasm을 받음. 앱과 같이 배포해서 외부 요청을 없앰
RuntimeLoader.setWasmUrl(riveWasm);

// Rive 에디터가 새 파일에 붙이는 기본 이름. 파일에서 이름을 바꾼 경우: 여기도 맞춰야 재생됨
const STATE_MACHINE = 'State Machine 1';

export default function RiveIcon({ name, size, className = '', fallback }) {
  const [failed, setFailed] = useState(false);
  const { RiveComponent } = useRive({
    src: `/assets/rive/${name}.riv`,
    stateMachine: STATE_MACHINE,
    autoplay: true,
    onLoadError: () => setFailed(true),
  });
  if (failed) return fallback;
  return (
    <div className={`block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <RiveComponent />
    </div>
  );
}
