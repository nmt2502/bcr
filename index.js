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

// bỏ T (HÒA)
function cleanKetQua(kq = "") {
  return kq.replace(/T/g, "");
}

// mức độ tin cậy
function getMucDoTinCay(p) {
  if (p >= 90) return "Rất Mạnh";
  if (p >= 70) return "Trung Bình";
  if (p >= 50) return "Yếu";
  return "Không Khuyến Nghị";
}

// so cầu mềm (không cần khớp 100%)
function compareSoft(ket_qua, pattern) {
  const clean = cleanKetQua(ket_qua);
  const n = pattern.length;
  const recent = clean.slice(-n);

  let score = 0;
  let total = 0;

  for (let i = 0; i < recent.length; i++) {
    const w = i + 1;
    total += w;
    if (recent[i] === pattern[i]) score += w;
  }

  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  return percent;
}

// dự đoán tiếp (nếu T -> giữ nguyên)
function duDoanTiep(pattern, ket_qua, du_doan_cu) {
  const last = ket_qua.slice(-1);
  if (last === "T") return du_doan_cu;
  const clean = cleanKetQua(ket_qua);
  return pattern[clean.length % pattern.length];
}

/* ================== CORE ANALYZE ================== */
function analyzeKetQua(ket_qua, du_doan_cu) {
  let best = null;

  for (const [loai, patterns] of Object.entries(ALGORITHMS)) {
    for (const p of patterns) {
      const percent = compareSoft(ket_qua, p);
      if (percent >= 70) {
        if (!best || percent > best.do_tin_cay) {
          best = {
            loai_cau: loai,
            mau: p,
            do_tin_cay: percent,
            du_doan_tiep: duDoanTiep(p, ket_qua, du_doan_cu)
          };
        }
      }
    }
  }

  return best;
}

/* ================== API ================== */

// health
app.get("/", (req, res) => {
  res.send("API SOI CẦU OK");
});

// gọi riêng từng bàn
app.get("/api/ban/:id", async (req, res) => {
  try {
    const banId = req.params.id.toUpperCase();
    const { data } = await axios.get(
      "https://bcrapj-sgpl.onrender.com/sexy/all"
    );

    const banData = data.find(i => i.ban === banId);
    if (!banData) return res.json({ error: "Không có bàn" });

    const analysis = analyzeKetQua(
      banData.ket_qua,
      banData.du_doan
    );

    if (!analysis) {
      return res.json({
        ban: banId,
        trang_thai: "Không có cầu theo"
      });
    }

    res.json({
      ban: banData.ban,
      cau: {
        "Cầu": banData.cau,
        "ket_qua": banData.ket_qua,
        "du_doan": analysis.du_doan_tiep,
        "loai_cau": analysis.loai_cau,
        "mau_cau": analysis.mau,
        "do_tin_cay": analysis.do_tin_cay + "%",
        "muc_do_tin_cay": getMucDoTinCay(analysis.do_tin_cay),
        "time": new Date().toLocaleTimeString("vi-VN", { hour12: false })
      }
    });
  } catch (e) {
    res.status(500).json({ error: "API error" });
  }
});

// ================== AUTO BÀN ĐẸP (KHÔNG RESET) ==================
app.get("/api/ban/auto", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://bcrapj-sgpl.onrender.com/sexy/all"
    );

    // 1️⃣ giữ bàn cũ nếu còn ổn
    if (CURRENT_BAN) {
      const banData = data.find(i => i.ban === CURRENT_BAN);
      if (banData) {
        const analysis = analyzeKetQua(
          banData.ket_qua,
          banData.du_doan
        );

        if (analysis && analysis.do_tin_cay >= 70) {
          return res.json({
            ban: banData.ban,
            cau: {
              "Cầu": banData.cau,
              "ket_qua": banData.ket_qua,
              "du_doan": analysis.du_doan_tiep,
              "loai_cau": analysis.loai_cau,
              "mau_cau": analysis.mau,
              "do_tin_cay": analysis.do_tin_cay + "%",
              "muc_do_tin_cay": getMucDoTinCay(analysis.do_tin_cay),
              "ghi_chu": "Giữ nguyên bàn đang theo",
              "time": new Date().toLocaleTimeString("vi-VN", { hour12: false })
            }
          });
        }
      }
      CURRENT_BAN = null;
    }

    // 2️⃣ tìm bàn mới mạnh nhất
    let best = null;

    for (let i = 1; i <= 16; i++) {
      const id = `C${String(i).padStart(2, "0")}`;
      const banData = data.find(b => b.ban === id);
      if (!banData) continue;

      const analysis = analyzeKetQua(
        banData.ket_qua,
        banData.du_doan
      );
      if (!analysis || analysis.do_tin_cay < 70) continue;

      if (!best || analysis.do_tin_cay > best.analysis.do_tin_cay) {
        best = { banData, analysis };
      }
    }

    if (!best) {
      return res.json({
        status: "NO_BAN_DEP",
        message: "Không có bàn đẹp"
      });
    }

    CURRENT_BAN = best.banData.ban;

    res.json({
      ban: best.banData.ban,
      cau: {
        "Cầu": best.banData.cau,
        "ket_qua": best.banData.ket_qua,
        "du_doan": best.analysis.du_doan_tiep,
        "loai_cau": best.analysis.loai_cau,
        "mau_cau": best.analysis.mau,
        "do_tin_cay": best.analysis.do_tin_cay + "%",
        "muc_do_tin_cay": getMucDoTinCay(best.analysis.do_tin_cay),
        "ghi_chu": "Đổi sang bàn mạnh hơn",
        "time": new Date().toLocaleTimeString("vi-VN", { hour12: false })
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
