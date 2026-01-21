const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== GLOBAL ================== */
let CURRENT_BAN = null;
const SOURCE_API = "https://bcrapj-sgpl.onrender.com/sexy/all";

/* ================== THUẬT TOÁN ================== */
const ALGORITHMS = {
  "1-1": ["PBPBP", "BPBPBP"],
  "2-2": ["PPBBPPBB", "BBPPBBPP"],
  "1-2-1": ["PBBP", "BPPB"],
  "1-3": ["PBBB", "BPPP"],
  "3-1": ["PPPB", "BBBP"],
  "2-1": ["PPB", "BBP"],
  "1-2": ["PBB", "BPP"],
  "day-3": ["PPP", "BBB"],
  "day-4": ["PPPP", "BBBB"],
  "zigzag": ["PBPB", "BPBP"]
};

/* ================== UTIL ================== */
const cleanKetQua = kq => kq.replace(/T/g, "");

const getMucDoTinCay = p =>
  p >= 90 ? "Rất Mạnh" :
  p >= 70 ? "Trung Bình" :
  p >= 50 ? "Yếu" : "Không Khuyến Nghị";

function compareSoft(ket_qua, pattern) {
  const clean = cleanKetQua(ket_qua);
  const recent = clean.slice(-pattern.length);
  let score = 0, total = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = i + 1;
    total += w;
    if (recent[i] === pattern[i]) score += w;
  }
  return total ? Math.round(score / total * 100) : 0;
}

function duDoanTiep(pattern, ket_qua, cu) {
  if (ket_qua.slice(-1) === "T") return cu;
  return pattern[cleanKetQua(ket_qua).length % pattern.length];
}

function analyzeKetQua(kq, cu) {
  let best = null;
  for (const [loai, arr] of Object.entries(ALGORITHMS)) {
    for (const p of arr) {
      const pt = compareSoft(kq, p);
      if (pt >= 70 && (!best || pt > best.do_tin_cay)) {
        best = {
          loai_cau: loai,
          mau: p,
          do_tin_cay: pt,
          du_doan_tiep: duDoanTiep(p, kq, cu)
        };
      }
    }
  }
  return best;
}

/* ================== API ================== */

app.get("/", (_, res) => res.send("API SOI CẦU OK"));

/* ===== TỪNG BÀN ===== */
app.get("/api/ban/:id", async (req, res) => {
  const { data } = await axios.get(SOURCE_API);
  const ban = data.find(b => b.ban === req.params.id.toUpperCase());
  if (!ban) return res.json({ error: "Không có bàn" });

  const a = analyzeKetQua(ban.ket_qua, ban.du_doan);
  if (!a) return res.json({ ban: ban.ban, trang_thai: "Không có cầu" });

  res.json({ ban: ban.ban, cau: { ...a, du_doan: a.du_doan_tiep } });
});

/* ===== AUTO BÀN ĐẸP (KHÔNG RESET) ===== */
app.get("/api/ban/auto", async (_, res) => {
  const { data } = await axios.get(SOURCE_API);

  // Giữ bàn cũ
  if (CURRENT_BAN) {
    const b = data.find(x => x.ban === CURRENT_BAN);
    if (b) {
      const a = analyzeKetQua(b.ket_qua, b.du_doan);
      if (a && a.do_tin_cay >= 70) {
        return res.json({ ban: b.ban, cau: a, ghi_chu: "Giữ bàn cũ" });
      }
    }
  }

  // Tìm bàn mới
  let best = null;
  for (let i = 1; i <= 16; i++) {
    const id = `C${String(i).padStart(2, "0")}`;
    const b = data.find(x => x.ban === id);
    if (!b) continue;
    const a = analyzeKetQua(b.ket_qua, b.du_doan);
    if (a && (!best || a.do_tin_cay > best.a.do_tin_cay)) {
      best = { b, a };
    }
  }

  if (!best) return res.json({ status: "NO_BAN_DEP" });

  CURRENT_BAN = best.b.ban;
  res.json({ ban: best.b.ban, cau: best.a, ghi_chu: "Chọn bàn mới" });
});

/* ===== ALL ===== */
app.get("/api/ban/all", async (_, res) => {
  const { data } = await axios.get(SOURCE_API);
  const out = [];

  for (let i = 1; i <= 16; i++) {
    const id = `C${String(i).padStart(2, "0")}`;
    const b = data.find(x => x.ban === id);
    if (!b) continue;
    const a = analyzeKetQua(b.ket_qua, b.du_doan);
    out.push(a ? { ban: id, du_doan: a.du_doan_tiep, tin_cay: a.do_tin_cay + "%" }
               : { ban: id, trang_thai: "Không cầu" });
  }
  res.json({ total: out.length, data: out });
});

/* ================== START ================== */
app.listen(PORT, () => console.log("RUNNING:", PORT));
