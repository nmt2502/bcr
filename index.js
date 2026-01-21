const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== GLOBAL STATE ================== */
let CURRENT_BAN = null;

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
function cleanKetQua(kq = "") {
  return kq.replace(/T/g, "");
}

function getMucDoTinCay(p) {
  if (p >= 90) return "Rất Mạnh";
  if (p >= 70) return "Trung Bình";
  if (p >= 50) return "Yếu";
  return "Không Khuyến Nghị";
}

function compareSoft(ket_qua, pattern) {
  const clean = cleanKetQua(ket_qua);
  const recent = clean.slice(-pattern.length);

  let score = 0, total = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = i + 1;
    total += w;
    if (recent[i] === pattern[i]) score += w;
  }
  return total === 0 ? 0 : Math.round((score / total) * 100);
}

function duDoanTiep(pattern, ket_qua, du_doan_cu) {
  if (ket_qua.slice(-1) === "T") return du_doan_cu;
  const clean = cleanKetQua(ket_qua);
  return pattern[clean.length % pattern.length];
}

function analyzeKetQua(ket_qua, du_doan_cu) {
  let best = null;
  for (const [loai, patterns] of Object.entries(ALGORITHMS)) {
    for (const p of patterns) {
      const percent = compareSoft(ket_qua, p);
      if (percent >= 70 && (!best || percent > best.do_tin_cay)) {
        best = {
          loai_cau: loai,
          mau: p,
          do_tin_cay: percent,
          du_doan_tiep: duDoanTiep(p, ket_qua, du_doan_cu)
        };
      }
    }
  }
  return best;
}

/* ================== API ================== */

app.get("/", (req, res) => {
  res.send("API SOI CẦU OK");
});

// ================== API TỪNG BÀN ==================
app.get("/api/ban/:id", async (req, res) => {
  try {
    const banId = req.params.id.toUpperCase();

    const resApi = await axios.get("https://bcrapj-sgpl.onrender.com/sexy/all");
    const data = resApi.data.data || resApi.data;

    const banData = data.find(b => b.ban === banId);
    if (!banData) return res.json({ error: "Không có bàn" });

    const analysis = analyzeKetQua(banData.ket_qua, banData.du_doan);
    if (!analysis) return res.json({ ban: banId, trang_thai: "Không có cầu theo" });

    res.json({
      ban: banData.ban,
      cau: {
        Cầu: banData.cau,
        ket_qua: banData.ket_qua,
        du_doan: analysis.du_doan_tiep,
        loai_cau: analysis.loai_cau,
        mau_cau: analysis.mau,
        do_tin_cay: analysis.do_tin_cay + "%",
        muc_do_tin_cay: getMucDoTinCay(analysis.do_tin_cay),
        time: new Date().toLocaleTimeString("vi-VN", { hour12: false })
      }
    });
  } catch {
    res.status(500).json({ error: "API error" });
  }
});

// ================== API AUTO (KHÔNG RESET) ==================
app.get("/api/ban/auto", async (req, res) => {
  try {
    const resApi = await axios.get("https://bcrvip.onrender.com/api/ban/all");
    const data = resApi.data.data || resApi.data;

    if (CURRENT_BAN) {
      const old = data.find(b => b.ban === CURRENT_BAN);
      if (old) {
        const a = analyzeKetQua(old.ket_qua, old.du_doan);
        if (a && a.do_tin_cay >= 70) {
          return res.json({
            ban: old.ban,
            cau: {
              Cầu: old.cau,
              ket_qua: old.ket_qua,
              du_doan: a.du_doan_tiep,
              do_tin_cay: a.do_tin_cay + "%",
              muc_do_tin_cay: getMucDoTinCay(a.do_tin_cay),
              ghi_chu: "Giữ bàn"
            }
          });
        }
      }
      CURRENT_BAN = null;
    }

    let best = null;
    for (let i = 1; i <= 16; i++) {
      const id = `C${String(i).padStart(2, "0")}`;
      const b = data.find(x => x.ban === id);
      if (!b) continue;

      const a = analyzeKetQua(b.ket_qua, b.du_doan);
      if (a && (!best || a.do_tin_cay > best.analysis.do_tin_cay)) {
        best = { b, analysis: a };
      }
    }

    if (!best) return res.json({ status: "NO_BAN_DEP" });

    CURRENT_BAN = best.b.ban;
    res.json({
      ban: best.b.ban,
      cau: {
        Cầu: best.b.cau,
        ket_qua: best.b.ket_qua,
        du_doan: best.analysis.du_doan_tiep,
        do_tin_cay: best.analysis.do_tin_cay + "%",
        muc_do_tin_cay: getMucDoTinCay(best.analysis.do_tin_cay),
        ghi_chu: "Chọn bàn mới"
      }
    });

  } catch {
    res.status(500).json({ error: "AUTO error" });
  }
});

// ================== API ALL BÀN ==================
app.get("/api/ban/all", async (req, res) => {
  try {
    const resApi = await axios.get("https://bcrapj-sgpl.onrender.com/sexy/all");
    const data = resApi.data.data || resApi.data;

    const result = [];

    for (let i = 1; i <= 16; i++) {
      const id = `C${String(i).padStart(2, "0")}`;
      const b = data.find(x => x.ban === id);
      if (!b) continue;

      const a = analyzeKetQua(b.ket_qua, b.du_doan);
      result.push(
        a
          ? {
              ban: id,
              du_doan: a.du_doan_tiep,
              do_tin_cay: a.do_tin_cay + "%",
              muc_do_tin_cay: getMucDoTinCay(a.do_tin_cay)
            }
          : { ban: id, trang_thai: "Không có cầu" }
      );
    }

    res.json({ total: result.length, data: result });
  } catch {
    res.status(500).json({ error: "ALL error" });
  }
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log("API running on port", PORT);
});
