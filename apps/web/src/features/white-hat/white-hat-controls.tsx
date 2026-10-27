'use client';
import { useState, type FormEvent } from 'react';
import type { WhiteHatSetup, WhiteHatSnapshot } from '../../../../../packages/contracts/src';
import { Panel } from '../table/panel';
import { actionIds, memberName, roleNames } from './white-hat-pieces';

export type WhiteHatSend = (event: string, body: Record<string, unknown>) => void;
export function Setup({
  table,
  locked,
  send,
}: {
  table: WhiteHatSnapshot;
  locked: boolean;
  send: WhiteHatSend;
}) {
  const [custom, setCustom] = useState(table.config.roleMode === 'custom');
  const count = table.players.filter((p) => !p.isModerator && !p.departed).length;
  const prepared = Boolean(table.moderator?.civilianWord && table.moderator.spyWord);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const setup: WhiteHatSetup = {
      eliminationsPerRound: Number(data.get('k')),
      roleMode: custom ? 'custom' : 'auto',
      spyCount: custom ? Number(data.get('spies')) : table.config.spyCount,
      whiteCount: custom ? Number(data.get('whites')) : table.config.whiteCount,
      civilianWord: String(data.get('civilianWord')),
      spyWord: String(data.get('spyWord')),
    };
    send('white-hat:configure', { setup });
  }
  return (
    <section className="wh-setup wh-surface">
      <header>
        <span className="wh-kicker">BẠN LÀ QUẢN TRÒ</span>
        <h2>Chuẩn bị ván</h2>
        <p>Hai từ gần nhau. Một màn suy luận thật vui.</p>
      </header>
      <form onSubmit={save}>
        <label>
          Từ dân thường
          <input
            name="civilianWord"
            autoComplete="off"
            required
            maxLength={80}
            defaultValue={table.moderator?.civilianWord}
            placeholder="Nhập một từ…"
          />
        </label>
        <label>
          Từ gián điệp
          <input
            name="spyWord"
            autoComplete="off"
            required
            maxLength={80}
            defaultValue={table.moderator?.spyWord}
            placeholder="Nhập từ còn lại…"
          />
        </label>
        <label>
          Số người bị loại mỗi vòng
          <input
            name="k"
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(1, count - 1)}
            required
            defaultValue={table.config.eliminationsPerRound}
          />
        </label>
        <label className="wh-check">
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
          <span>Tùy chỉnh số role</span>
        </label>
        {custom ? (
          <div className="wh-field-pair">
            <label>
              Số gián điệp
              <input
                name="spies"
                type="number"
                inputMode="numeric"
                min={1}
                max={11}
                required
                defaultValue={table.config.spyCount}
              />
            </label>
            <label>
              Số mũ trắng
              <input
                name="whites"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                required
                defaultValue={table.config.whiteCount}
              />
            </label>
          </div>
        ) : (
          <p className="wh-role-summary">
            {table.config.spyCount} gián điệp <span>·</span> {table.config.whiteCount} mũ trắng{' '}
            <span>·</span> {Math.max(0, count - table.config.spyCount - table.config.whiteCount)}{' '}
            dân thường
          </p>
        )}
        <button className="wh-secondary wh-full" disabled={locked}>
          Lưu cấu hình và từ
        </button>
        <p className="wh-form-note">
          {prepared
            ? '✓ Đã lưu bộ từ. Nếu chỉnh form, hãy lưu lại trước khi bắt đầu.'
            : 'Lưu hai từ khác nhau để mở cuộc chơi.'}
        </p>
      </form>
      <button
        className="wh-primary wh-full"
        disabled={
          locked || !prepared || count < 4 || table.players.some((p) => !p.departed && !p.connected)
        }
        onClick={() => send('room:start', {})}
      >
        Bắt đầu ván Mũ Trắng <span aria-hidden="true">→</span>
      </button>
      {count < 4 && <p className="wh-form-note">Chờ thêm {4 - count} người bạn để bắt đầu.</p>}
    </section>
  );
}
export function Moderator({
  table,
  visible,
  toggle,
  locked,
  send,
}: {
  table: WhiteHatSnapshot;
  visible: boolean;
  toggle: () => void;
  locked: boolean;
  send: WhiteHatSend;
}) {
  return (
    <section className="wh-moderator wh-surface">
      <span className="wh-kicker">BẠN CẦM NHỊP CUỘC CHƠI</span>
      <h2>Điều hành</h2>
      <p>Giữ bí mật và để cả nhóm tự suy luận.</p>
      <button className="wh-secondary wh-full" onClick={toggle}>
        {visible ? 'Che bí mật quản trò' : 'Xem bí mật quản trò'}
      </button>
      {visible && table.moderator && (
        <div className="wh-secrets">
          <p>
            Dân thường: <strong>{table.moderator.civilianWord}</strong>
          </p>
          <p>
            Gián điệp: <strong>{table.moderator.spyWord}</strong>
          </p>
          <ul>
            {table.moderator.roles.map((p) => (
              <li key={p.memberId}>
                <span>{memberName(table, p.memberId)}</span>
                <strong>{roleNames[p.role]}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {['discussion', 'intermission'].includes(table.stage) && (
        <button
          className="wh-primary wh-full"
          disabled={locked}
          onClick={() => send('white-hat:advance', actionIds(table))}
        >
          {table.stage === 'discussion' ? 'Mở bỏ phiếu' : 'Bắt đầu vòng tiếp theo'}{' '}
          <span aria-hidden="true">→</span>
        </button>
      )}
      {table.stage === 'last-guess' && (
        <p className="wh-form-note">Đợi đủ 30 giây trước khi xét thắng theo phe.</p>
      )}
    </section>
  );
}
export function Actions({
  table,
  selected,
  locked,
  send,
}: {
  table: WhiteHatSnapshot;
  selected: string[];
  locked: boolean;
  send: WhiteHatSend;
}) {
  const [guess, setGuess] = useState('');
  const [confirm, setConfirm] = useState(false);
  const hostTie = table.hostMemberId === table.viewerMemberId && table.stage === 'tie-break';
  const voting = table.legalActions.canVote || hostTie;
  const living = table.players.filter((p) => !p.isModerator && !p.eliminated && !p.departed);
  const submitted = table.submittedMemberIds.filter((id) =>
    living.some((p) => p.memberId === id),
  ).length;
  const names = (id: string) => memberName(table, id);
  return (
    <section
      className={`wh-action wh-surface ${voting ? 'wh-vote-action' : ''}`}
      aria-label="Hành động hiện tại"
    >
      {table.legalActions.canDescribe ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send('white-hat:describe', {
              ...actionIds(table),
              text: new FormData(e.currentTarget).get('description'),
            });
          }}
        >
          <span className="wh-kicker">MỌI NGƯỜI ĐANG LẮNG NGHE</span>
          <h2>Lượt của bạn</h2>
          <label>
            Mô tả của bạn
            <input
              name="description"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="Một từ hoặc cụm từ…"
            />
          </label>
          <p className="wh-form-note">Gợi ý vừa đủ, đừng để lộ từ riêng nhé!</p>
          <button className="wh-primary wh-full" disabled={locked}>
            Gửi mô tả <span aria-hidden="true">→</span>
          </button>
        </form>
      ) : (
        table.stage === 'description' && (
          <div className="wh-waiting">
            <span className="wh-thinking" aria-hidden="true">
              …
            </span>
            <h2>Đang nghe mô tả</h2>
            <p>
              Chờ <strong>{names(table.actingMemberId ?? '')}</strong> đưa ra manh mối.
            </p>
          </div>
        )
      )}
      {voting && (
        <>
          <span className="wh-kicker">
            {hostTie ? 'QUYẾT ĐỊNH CỦA QUẢN TRÒ' : 'TIN VÀO SUY LUẬN CỦA BẠN'}
          </span>
          <h2>{hostTie ? 'Chọn người trong nhóm hòa' : 'Phiếu của bạn'}</h2>
          <p>Chọn {table.ballotSize} người trên sân chơi.</p>
          {table.selectedIds.length > 0 && (
            <p className="wh-locked-picks">
              Suất đã chốt: {table.selectedIds.map(names).join(', ')}
            </p>
          )}
          <div className="wh-selection-preview">
            {selected.length ? (
              selected.map((id) => <span key={id}>✓ {names(id)}</span>)
            ) : (
              <span className="wh-muted">Chạm vào nhân vật bạn nghi ngờ</span>
            )}
          </div>
          {!hostTie && (
            <p className="wh-submission">
              Đã gửi{' '}
              <strong>
                {submitted}/{living.length}
              </strong>
              <span className="wh-meter">
                <i style={{ width: `${living.length ? (submitted / living.length) * 100 : 0}%` }} />
              </span>
            </p>
          )}
          <div className="wh-action-dock">
            <span>
              Đã chọn{' '}
              <strong>
                {selected.length}/{table.ballotSize}
              </strong>
            </span>
            <button
              className="wh-primary wh-full"
              disabled={locked || selected.length !== table.ballotSize}
              onClick={() =>
                send(hostTie ? 'white-hat:resolve-tie' : 'white-hat:vote', {
                  ...actionIds(table),
                  targetIds: selected,
                })
              }
            >
              {hostTie ? 'Chốt người bị loại' : 'Gửi phiếu'} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </>
      )}
      {table.ownBallot && ['voting', 'revote'].includes(table.stage) && (
        <div className="wh-submitted">
          <span aria-hidden="true">✓</span>
          <h2>Phiếu đã gửi!</h2>
          <p>{table.ownBallot.map(names).join(', ')}</p>
          <small>Đang chờ cả nhóm chốt lựa chọn.</small>
        </div>
      )}
      {['voting', 'revote'].includes(table.stage) && !voting && !table.ownBallot && (
        <div className="wh-waiting">
          <span className="wh-thinking" aria-hidden="true">
            ✓
          </span>
          <h2>Cả nhóm đang bỏ phiếu</h2>
          <p>
            Đã gửi {submitted}/{living.length}. Phiếu sẽ được công khai khi chốt.
          </p>
        </div>
      )}
      {table.legalActions.canGuess && (
        <form
          className="wh-guess-form"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirm(true);
          }}
        >
          <span className="wh-kicker">MỘT LẦN ĐOÁN, MỘT CƠ HỘI</span>
          <h2>{table.stage === 'last-guess' ? 'Cơ hội đoán cuối' : 'Bạn muốn lộ diện?'}</h2>
          <label>
            Đoán từ dân thường
            <input
              required
              maxLength={80}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              autoComplete="off"
              placeholder="Bạn đã tìm ra từ chưa?"
            />
          </label>
          <p className="wh-form-note">Đúng thì thắng ngay. Sai sẽ bị loại. Đáp án cần đúng dấu.</p>
          <button className="wh-coral wh-full" disabled={locked || !guess.trim()}>
            Lộ diện và đoán
          </button>
        </form>
      )}
      {table.stage === 'last-guess' && !table.legalActions.canGuess && (
        <div className="wh-waiting">
          <span className="wh-thinking" aria-hidden="true">
            ?
          </span>
          <h2>Chờ thêm một chút…</h2>
          <p>Hết thời gian đoán cuối, kết quả sẽ được công bố.</p>
        </div>
      )}
      {['discussion', 'intermission'].includes(table.stage) &&
        table.hostMemberId !== table.viewerMemberId &&
        !table.legalActions.canGuess && (
          <div className="wh-waiting">
            <span className="wh-thinking" aria-hidden="true">
              “ ”
            </span>
            <h2>Cùng bàn luận nào!</h2>
            <p>Quản trò sẽ chuyển sang giai đoạn tiếp theo.</p>
          </div>
        )}
      {table.stage === 'tie-break' && !hostTie && (
        <div className="wh-waiting">
          <h2>Đợi quản trò phân xử</h2>
          <p>Nhóm hòa sẽ có kết quả trong chốc lát.</p>
        </div>
      )}
      {confirm && table.legalActions.canGuess && (
        <Panel title="Xác nhận đoán từ" close={() => setConfirm(false)}>
          <div className="wh-confirm-icon" aria-hidden="true">
            ?
          </div>
          <p>
            Bạn sẽ lộ diện và đoán <strong>“{guess}”</strong>. Đoán sai sẽ bị loại.
          </p>
          <button
            className="wh-coral wh-full"
            disabled={locked}
            onClick={() => {
              send('white-hat:guess', { ...actionIds(table), text: guess });
              setConfirm(false);
            }}
          >
            Xác nhận lộ diện và đoán
          </button>
        </Panel>
      )}
    </section>
  );
}
export function Rules() {
  return (
    <div className="wh-rules">
      <ol>
        <li>
          <strong>Nhận từ bí mật.</strong> Dân thường và gián điệp nhận hai từ khác nhau; mũ trắng
          không có từ. Người chơi không thấy nhãn role của mình hoặc người khác.
        </li>
        <li>
          <strong>Mỗi người một mô tả.</strong> Có 60 giây cho một từ/cụm từ. Hết giờ bỏ lượt, không
          bị loại.
        </li>
        <li>
          <strong>Thảo luận rồi chọn K người.</strong> Phiếu kín tới khi chốt, sau đó công khai ai
          bầu ai. Hòa thì bầu lại một lần; vẫn hòa do quản trò phân xử.
        </li>
        <li>
          <strong>Mũ trắng có một lần đoán.</strong> Có thể lộ diện ở khoảng nghỉ trước/sau vote nếu
          ván còn tiếp tục; bị vote loại vẫn có 30 giây đoán cuối. Đúng thắng riêng ngay, sai bị
          loại.
        </li>
        <li>
          <strong>Tìm phe chiến thắng.</strong> Dân thường thắng khi hết gián điệp và mũ trắng; gián
          điệp thắng khi bằng/vượt tổng người sống khác, sau quyền đoán cuối.
        </li>
        <li>
          <strong>Chỉ còn mũ trắng?</strong> Có 30 giây đoán cuối. Không ai đúng thì dân thường
          thắng dù đã bị loại.
        </li>
      </ol>
      <p className="wh-form-note">
        Đoán không phân biệt hoa/thường hoặc khoảng trắng thừa, nhưng phải đúng dấu. Người bị loại
        chỉ được xem, role giữ kín tới cuối ván. Quản trò điều hành, không tham gia chia role.
      </p>
    </div>
  );
}
