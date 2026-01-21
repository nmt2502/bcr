
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== STATE ================== */
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
const cleanKetQua = kq => (kq || "").replace(/T/g, "");

const getMucDoTinCay = p => {
  if (p >= 90) return "Rất Mạnh";
  if (p >= 70) return "Trung Bình";
  if (p >= 50) return "Yếu";
  return "Không Khuyến Nghị";
};

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

/* ================== API GỐC ================== */
async function getBanFromSource(id) {
  const res = await axios.get("https://bcrapj-sgpl.onrender.com/sexy/all");
  const data = res.data.data || res.data;
  return data.find(b => b.ban === id);
}

/* ================== API ================== */
app.get("/", (req, res) => {
  res.send("API SOI CẦU OK");
});

/* ===== API TỪNG BÀN (API CHUẨN GỐC) ===== */
app.get("/api/ban/:id", async (req, res) => {
  try {
    const id = req.params.id.toUpperCase();
    const ban = await getBanFromSource(id);
    if (!ban) return res.json({ error: "Không có bàn" });

    const a = analyzeKetQua(ban.ket_qua, ban.du_doan);
    if (!a) return res.json({ ban: id, cau: null });

    res.json({
      ban: ban.ban,
      cau: {
        "Cầu": ban.cau,
        "ket_qua": ban.ket_qua,
        "du_doan": a.du_doan_tiep,
        "do_tin_cay": a.do_tin_cay + "%",
        "muc_do_tin_cay": getMucDoTinCay(a.do_tin_cay),
        "time": new Date().toLocaleTimeString("vi-VN", { hour12: false })
      }
    });
  } catch {
    res.status(500).json({ error: "API error" });
  }
});

/* ===== API ALL (DÙNG LẠI /api/ban/:id) ===== */
app.get("/api/ban/all", async (req, res) => {
  try {
    const result = [];

    for (let i = 1; i <= 16; i++) {
      const id = `C${String(i).padStart(2, "0")}`;
      const r = await axios.get(
        `http://localhost:${PORT}/api/ban/${id}`
      );

      if (r.data && r.data.cau) {
        result.push({
          ban: id,
          cau: r.data.cau
        });
      } else {
        result.push({
          ban: id,
          trang_thai: "Không có cầu"
        });
      }
    }

    res.json({
      total: 16,
      data: result
    });

  } catch (e) {
    res.status(500).json({ error: "ALL error" });
  }
});

/* ===== API AUTO (CHECK BÀN ĐẸP TỪ /api/ban/:id) ===== */
app.get("/api/ban/auto", async (req, res) => {
  try {
    const r = await axios.get(
      `http://localhost:${PORT}/api/ban/all`
    );

    const data = r.data.data;

    let best = null;

    for (const item of data) {
      if (!item.cau) continue;

      const p = parseInt(item.cau.do_tin_cay);
      if (!best || p > best.p) {
        best = { ban: item.ban, cau: item.cau, p };
      }
    }

    if (!best) {
      return res.json({ error: "Không có bàn đẹp" });
    }

    res.json({
      ban: best.ban,
      cau: {
        ...best.cau,
        ghi_chu: "Bàn đẹp nhất từ ALL"
      }
    });

  } catch (e) {
    res.status(500).json({ error: "AUTO error" });
  }
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log("API running on port", PORT);
});
