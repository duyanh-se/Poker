'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CanvasTexture,
  Group,
  SRGBColorSpace,
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  CircleGeometry,
} from 'three';
import type { TableSnapshot } from './store';
import { seatAngle } from './seat-layout';
import { canRender3DTable } from './table-render-mode';

type Props = { table: TableSnapshot; hidden: boolean; animate: boolean; elapsedMs?: number };
const cardBody = new BoxGeometry(0.44, 0.018, 0.63);
const cardFace = new PlaneGeometry(0.43, 0.62);
const chipBody = new CylinderGeometry(0.105, 0.105, 0.045, 24);
const chipStripe = new BoxGeometry(0.032, 0.007, 0.03);
const chipFace = new CircleGeometry(0.066, 24);
function QualityGuard({ reduce }: { reduce: () => void }) {
  const slow = useRef(0);
  useFrame((_, delta) => {
    if (delta > 0.035 && delta < 0.2) slow.current++;
    else slow.current = Math.max(0, slow.current - 1);
    if (slow.current > 20) {
      reduce();
      slow.current = 0;
    }
  });
  return null;
}
function faceTexture(label: string, color = '#172832', back = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = back ? '#164551' : '#fff8e7';
  ctx.fillRect(0, 0, 128, 180);
  ctx.strokeStyle = back ? '#a9bba0' : '#d3c9ae';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 116, 168);
  if (back) {
    ctx.strokeStyle = '#38717a';
    for (let x = -180; x < 128; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 180, 180);
      ctx.stroke();
    }
  }
  ctx.fillStyle = back ? '#e7c887' : color;
  ctx.font = 'bold 46px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, 64, 105);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
function CardMesh({
  card,
  position,
  animate,
  delay = 0,
  elapsedMs = 0,
  motionId,
  privatePeek = false,
}: {
  card?: string;
  position: [number, number, number];
  animate: boolean;
  delay?: number;
  elapsedMs?: number;
  motionId?: string;
  privatePeek?: boolean;
}) {
  const group = useRef<Group>(null);
  const elapsed = useRef(elapsedMs / 1000);
  const previousCard = useRef(card);
  const peekElapsed = useRef(1);
  const invalidate = useThree((s) => s.invalidate);
  const text = card
    ? `${card[0] === 'T' ? '10' : card[0]}${({ s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, string>)[card.slice(-1).toLowerCase()]}`
    : '♠';
  const texture = useMemo(
    () => faceTexture(text, card && /[hd]$/i.test(card) ? '#b92c43' : '#172832', !card),
    [text, card],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    const reveal = privatePeek && Boolean(card) !== Boolean(previousCard.current);
    peekElapsed.current =
      reveal &&
      document.visibilityState === 'visible' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 1;
    previousCard.current = card;
    invalidate();
  }, [card, privatePeek, invalidate]);
  useEffect(() => {
    elapsed.current = elapsedMs / 1000;
    invalidate();
  }, [animate, card, invalidate, motionId, elapsedMs]);
  useFrame((_, delta) => {
    if (!group.current) return;
    elapsed.current += delta;
    peekElapsed.current = Math.min(1, peekElapsed.current + delta / 0.32);
    const t = animate ? Math.min(1, Math.max(0, (elapsed.current - delay) / 0.45)) : 1;
    group.current.visible = !animate || elapsed.current >= delay;
    group.current.position.set(position[0] * t, position[1] + (1 - t) * 0.6, position[2] * t);
    group.current.rotation.y = (1 - t) * 0.3;
    group.current.rotation.z = Math.max(card ? 1 - t : 0, 1 - peekElapsed.current) * Math.PI;
    if (t < 1 || peekElapsed.current < 1) invalidate();
  });
  return (
    <group ref={group} position={position}>
      <mesh geometry={cardBody}>
        <meshStandardMaterial color="#eee5ce" />
      </mesh>
      <mesh geometry={cardFace} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <meshStandardMaterial map={texture} />
      </mesh>
    </group>
  );
}
function Chip({
  position,
  color = '#c69c54',
  label = '10',
}: {
  position: [number, number, number];
  color?: string;
  label?: string;
}) {
  const texture = useMemo(() => faceTexture(label, '#182b2c'), [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={position}>
      <mesh geometry={chipBody}>
        <meshStandardMaterial color={color} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          geometry={chipStripe}
          key={i}
          position={[
            Math.cos((i * Math.PI) / 3) * 0.088,
            0.025,
            Math.sin((i * Math.PI) / 3) * 0.088,
          ]}
          rotation={[0, (-i * Math.PI) / 3, 0]}
        >
          <meshStandardMaterial color="#f0e8d2" />
        </mesh>
      ))}
      <mesh geometry={chipFace} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <meshStandardMaterial map={texture} />
      </mesh>
    </group>
  );
}
function Pile({ amount, position }: { amount: number; position: [number, number, number] }) {
  return (
    <group position={position}>
      {Array.from(
        { length: Math.min(8, Math.max(1, Math.ceil(Math.log2(amount + 1)))) },
        (_, i) => (
          <Chip
            key={i}
            position={[0, i * 0.047, 0]}
            color={i % 2 ? '#28726b' : '#b6434e'}
            label={i % 2 ? '25' : '5'}
          />
        ),
      )}
    </group>
  );
}
function MotionPile({
  amount,
  from,
  to,
  animate,
  elapsedMs = 0,
  durationMs = 450,
  motionId,
}: {
  amount: number;
  from: [number, number, number];
  to: [number, number, number];
  animate: boolean;
  elapsedMs?: number;
  durationMs?: number;
  motionId?: string;
}) {
  const group = useRef<Group>(null);
  const progress = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    progress.current = elapsedMs / durationMs;
    invalidate();
  }, [amount, animate, invalidate, elapsedMs, durationMs, motionId]);
  useFrame((_, delta) => {
    if (!group.current) return;
    progress.current = Math.min(1, progress.current + (delta * 1000) / durationMs);
    const linear = animate ? progress.current : 1;
    const t = linear * linear * (3 - 2 * linear);
    group.current.position.set(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    );
    if (t < 1) invalidate();
  });
  return (
    <group ref={group}>
      <Pile amount={amount} position={[0, 0, 0]} />
    </group>
  );
}
function World({ table, hidden, animate, elapsedMs = 0 }: Props) {
  const [wagers, setWagers] = useState({
    snapshot: table,
    collected: {} as Record<string, number>,
  });
  if (wagers.snapshot !== table) {
    const sameHand = wagers.snapshot.handId === table.handId;
    setWagers({
      snapshot: table,
      collected:
        sameHand && table.transition?.id === wagers.snapshot.transition?.id
          ? wagers.collected
          : sameHand
            ? Object.fromEntries(
                wagers.snapshot.players.map((p) => [p.memberId, p.streetContribution ?? 0]),
              )
            : {},
    });
  }
  const size = useThree((state) => state.size);
  const stretch = Math.max(1.1, size.width / size.height / 2.1);
  const me = table.players.find((p) => p.memberId === table.viewerMemberId);
  const viewer = me?.seat ?? 0;
  const settled =
    table.phase === 'waiting' ||
    table.phase === 'paused' ||
    table.transition?.kind === 'payout' ||
    table.transition?.kind === 'fold-win';
  const collecting = ['street', 'showdown-reveal'].includes(table.transition?.kind ?? '');
  const awarding = ['payout', 'fold-win'].includes(table.transition?.kind ?? '');
  const publicShowdown = table.players.some(
    (p) => p.memberId !== table.viewerMemberId && p.holeCards?.length,
  );
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 8, 4]} intensity={2.4} color="#ffe0ad" />
      <pointLight position={[-4, 5, -2]} intensity={12} color="#68bfb0" />
      <group scale={[stretch, 1, 1]}>
        <group scale={[1.6, 1, 1]}>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[2.45, 2.4, 0.4, 96]} />
            <meshStandardMaterial color="#090f13" roughness={0.58} />
          </mesh>
          <mesh position={[0, 0.006, 0]}>
            <cylinderGeometry args={[2.19, 2.19, 0.035, 96]} />
            <meshStandardMaterial color="#4a0818" roughness={1} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
            <torusGeometry args={[2.3, 0.13, 12, 96]} />
            <meshStandardMaterial color="#202627" roughness={0.64} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
            <torusGeometry args={[2.12, 0.012, 6, 96]} />
            <meshStandardMaterial color="#bb9862" roughness={0.5} />
          </mesh>
        </group>
        {Array.from({ length: 4 }, (_, i) => (
          <CardMesh key={`deck${i}`} position={[-1.35, 0.05 + i * 0.024, -0.55]} animate={false} />
        ))}
        {size.width >= 1000 &&
          table.board.map((card, i) => (
            <CardMesh
              key={`${table.handId}:${i}`}
              card={card}
              position={[(i - (table.board.length - 1) / 2) * 0.5, 0.06, 0]}
              animate={
                animate &&
                table.transition?.kind === 'street' &&
                i >= (table.board.length === 3 ? 0 : table.board.length - 1)
              }
              elapsedMs={elapsedMs}
              motionId={table.transition?.id}
              delay={i * 0.04}
            />
          ))}
        {!awarding && table.players.some((p) => p.contribution > (p.streetContribution ?? 0)) && (
          <Pile
            amount={table.players.reduce(
              (sum, p) => sum + p.contribution - (p.streetContribution ?? 0),
              0,
            )}
            position={[0, 0.08, 0.65]}
          />
        )}
        {table.players.map((player) => {
          const angle = seatAngle(table, player.seat, viewer);
          const x = -Math.sin(angle) * 3.1;
          const z = Math.cos(angle) * 1.65;
          const show = player.memberId === table.viewerMemberId ? !hidden || publicShowdown : true;
          return (
            <group key={player.memberId}>
              {table.handId &&
                !player.folded &&
                [0, 1].map((i) => (
                  <CardMesh
                    key={`${table.handId}:${i}`}
                    card={show ? player.holeCards?.[i] : undefined}
                    privatePeek={player.memberId === table.viewerMemberId && !publicShowdown}
                    position={[x + (i - 0.5) * 0.38, 0.075, z]}
                    animate={
                      animate &&
                      (table.transition?.kind === 'deal' ||
                        table.transition?.kind === 'showdown-reveal')
                    }
                    elapsedMs={elapsedMs}
                    motionId={table.transition?.id}
                    delay={
                      table.transition?.kind === 'deal'
                        ? (i * table.players.filter((p) => !p.folded).length +
                            [...table.players]
                              .filter((p) => !p.folded)
                              .sort(
                                (a, b) =>
                                  ((a.seat - (table.buttonSeat ?? 0) + 8) % 9) -
                                  ((b.seat - (table.buttonSeat ?? 0) + 8) % 9),
                              )
                              .findIndex((p) => p.memberId === player.memberId)) *
                          (1.35 /
                            Math.max(1, table.players.filter((p) => !p.folded).length * 2 - 1))
                        : 0
                    }
                  />
                ))}
              {player.stack > 0 && <Pile amount={player.stack} position={[x + 0.58, 0.07, z]} />}
              {(collecting
                ? (wagers.collected[player.memberId] ?? 0)
                : (player.streetContribution ?? 0)) > 0 &&
                !settled && (
                  <MotionPile
                    amount={
                      collecting
                        ? (wagers.collected[player.memberId] ?? 0)
                        : (player.streetContribution ?? 0)
                    }
                    from={collecting ? [x * 0.65, 0.08, z * 0.65] : [x + 0.58, 0.08, z]}
                    to={collecting ? [0, 0.08, 0.65] : [x * 0.65, 0.08, z * 0.65]}
                    animate={
                      animate &&
                      (collecting ||
                        (table.transition?.kind === 'action' &&
                          ['call', 'bet', 'raise', 'all-in'].includes(
                            table.transition.action ?? '',
                          ) &&
                          table.transition?.actorMemberId === player.memberId))
                    }
                    elapsedMs={elapsedMs}
                    motionId={table.transition?.id}
                    durationMs={collecting ? 600 : 450}
                  />
                )}
              {awarding &&
                table.pots
                  .flatMap((p) => p.payouts ?? [])
                  .filter((p) => p.memberId === player.memberId)
                  .map((p, i) => (
                    <MotionPile
                      key={i}
                      amount={p.amount}
                      from={[0, 0.08, 0.65]}
                      to={[x + 0.58, 0.08, z]}
                      animate={animate}
                      elapsedMs={elapsedMs}
                      durationMs={1000}
                      motionId={table.transition?.id}
                    />
                  ))}
            </group>
          );
        })}
      </group>
    </>
  );
}
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function Fallback() {
  return (
    <div className="table-fallback" data-testid="table-2d">
      <div className="felt-fallback" />
      <span className="fallback-label">Chế độ bàn 2D</span>
    </div>
  );
}
export default function TableScene(props: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState(1);
  const [viewportSupports3D, setViewportSupports3D] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      setVisible(document.visibilityState === 'visible');
      setDpr(Math.min(window.devicePixelRatio, window.innerWidth < 1000 ? 1.5 : 2));
      setViewportSupports3D(canRender3DTable(window.innerWidth, window.innerHeight));
    };
    const initial = window.setTimeout(() => {
      update();
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2');
      if (!context) setFailed(true);
      else context.getExtension('WEBGL_lose_context')?.loseContext();
      setReady(true);
    }, 0);
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(initial);
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  if (!ready || failed || !viewportSupports3D) return <Fallback />;
  return (
    <Boundary fallback={<Fallback />}>
      <div className="scene-3d" data-testid="table-3d">
        <Canvas
          frameloop={visible ? 'demand' : 'never'}
          dpr={dpr}
          camera={{ position: [0, 8.7, 6.5], fov: 34 }}
          fallback={<Fallback />}
          onCreated={({ gl, camera }) => {
            camera.lookAt(0, 0, 0);
            gl.domElement.addEventListener(
              'webglcontextlost',
              (event) => {
                event.preventDefault();
                setFailed(true);
              },
              { once: true },
            );
          }}
        >
          <QualityGuard reduce={() => setDpr(1)} />
          <World {...props} animate={props.animate && !reduced && visible} />
        </Canvas>
      </div>
    </Boundary>
  );
}
