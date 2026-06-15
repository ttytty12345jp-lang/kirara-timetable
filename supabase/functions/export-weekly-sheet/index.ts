import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ExcelJS from "https://esm.sh/exceljs@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FULLWIDTH_DIGITS = ["０","１","２","３","４","５","６","７","８","９"];

function fmt(dateStr: string) {
  const [, mm, dd] = dateStr.split("-");
  return `${parseInt(mm)}月${parseInt(dd)}日`;
}

function getPlace(className: string, subject?: string) {
  if (!className) return "";
  if (subject === "体育") return "運動場/体育館";
  if (subject === "図書") return "図書室";
  if (subject === "理科") return "理科室/教室";
  if (subject === "音楽") return "音楽室/教室";
  if (className === "いるか") return "いるか";
  if (className === "えい・かに" || className === "えい" || className === "かに") return "きらら教室（えい）";
  return "教室";
}

function getDisplayClass(className: string, subject?: string) {
  if (subject === "プール") {
    const grade = className.match(/^(\d)/);
    if (grade) return `${FULLWIDTH_DIGITS[parseInt(grade[1])]}年`;
  }
  if (className === "いるか" || className === "えい・かに" || className === "えい" || className === "かに") {
    return "抽出";
  }
  return className;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payload = body.weekData ? body.weekData : body;
    const { teacher, monday, schedule } = payload;

    if (!teacher || !monday || !schedule) {
      return new Response(
        JSON.stringify({ error: "teacher, monday, schedule が必要です" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("週案");

    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    };

    const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];
    const PERIOD_ROWS: Record<string, number> = {
      "1限": 4, "2限": 6, "3限": 8, "4限": 10,
      "給食": 12,
      "5限": 13, "6限": 15,
    };

    const DAY_COLS = [2, 4, 6, 8, 10];

    worksheet.mergeCells("A1:I1");
    const cellMonth = worksheet.getCell("A1");
    const monthNum = parseInt(monday.split("-")[1]);
    cellMonth.value = `${monthNum}月`;
    cellMonth.font = { size: 20, bold: true, name: "Yu Gothic" };
    cellMonth.alignment = { vertical: "middle" };

    worksheet.mergeCells("J1:K1");
    const cellTeacher = worksheet.getCell("J1");
    cellTeacher.value = `担任名：${teacher}`;
    cellTeacher.font = { size: 11, bold: true, name: "Yu Gothic" };
    cellTeacher.alignment = { horizontal: "right", vertical: "middle" };
    worksheet.getRow(1).height = 34;

    worksheet.mergeCells("B2:K2");
    const cellRange = worksheet.getCell("B2");
    const friday = schedule[4]?.date ?? monday;
    cellRange.value = `${fmt(monday)}（月） 〜 ${fmt(friday)}（金）`;
    cellRange.font = { size: 14, name: "Yu Gothic" };
    cellRange.alignment = { vertical: "middle" };
    worksheet.getRow(2).height = 30;

    worksheet.getRow(3).height = 26;
    const cellDiagonal = worksheet.getCell("A3");
    cellDiagonal.font = { size: 10, name: "Yu Gothic" };
    cellDiagonal.alignment = { horizontal: "center", vertical: "middle" };
    cellDiagonal.border = {
      diagonal: { up: false, down: true, style: "thin", color: { argb: "FF000000" } }
    };

    for (let i = 0; i < schedule.length; i++) {
      const col = DAY_COLS[i];
      worksheet.mergeCells(3, col, 3, col + 1);
      const cellDay = worksheet.getCell(3, col);
      const [, , dd] = schedule[i].date.split("-");
      cellDay.value = `${parseInt(dd)}日（${schedule[i].day}）`;
      cellDay.font = { size: 11, bold: true, name: "Yu Gothic" };
      cellDay.alignment = { horizontal: "center", vertical: "middle" };
      cellDay.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    }

    const rowHeights: Record<number, number> = {
      4: 40, 5: 40,
      6: 40, 7: 40,
      8: 40, 9: 40,
      10: 40, 11: 40,
      12: 40,
      13: 40, 14: 40,
      15: 40, 16: 40
    };

    DISPLAY_PERIODS.forEach((period) => {
      const rowS = PERIOD_ROWS[period];
      const isLunch = period === "給食";

      if (isLunch) {
        const cellLabel = worksheet.getCell(rowS, 1);
        cellLabel.value = period;
        cellLabel.font = { bold: true, name: "Yu Gothic" };
        cellLabel.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        worksheet.mergeCells(rowS, 1, rowS + 1, 1);
        const cellLabel = worksheet.getCell(rowS, 1);
        cellLabel.value = period;
        cellLabel.font = { bold: true, name: "Yu Gothic" };
        cellLabel.alignment = { horizontal: "center", vertical: "middle" };
      }

      for (let i = 0; i < schedule.length; i++) {
        const col = DAY_COLS[i];
        const cd = schedule[i].periods.find((p: any) => p.period === period);
        const cls = cd?.class_name ?? "";
        const sub = (period === "5限" && i === 1) ? "きららタイム" : (cd?.subject ?? "");

        if (isLunch) {
          worksheet.mergeCells(rowS, col, rowS, col + 1);
          const cellClass = worksheet.getCell(rowS, col);
          cellClass.value = getDisplayClass(cls, sub);
          cellClass.font = { name: "Yu Gothic" };
          cellClass.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          const cellClass = worksheet.getCell(rowS, col);
          cellClass.value = getDisplayClass(cls, sub);
          cellClass.font = { name: "Yu Gothic" };
          cellClass.alignment = { horizontal: "center", vertical: "middle" };

          const cellSub = worksheet.getCell(rowS, col + 1);
          cellSub.value = sub;
          cellSub.font = { bold: true, name: "Yu Gothic" };
          cellSub.alignment = { horizontal: "center", vertical: "middle" };

          worksheet.mergeCells(rowS + 1, col, rowS + 1, col + 1);
          const cellPlace = worksheet.getCell(rowS + 1, col);
          cellPlace.value = getPlace(cls, sub);
          cellPlace.font = { size: 9, color: { argb: "FF595959" }, name: "Yu Gothic" };
          cellPlace.alignment = { horizontal: "center", vertical: "middle" };
        }
      }
    });

    Object.keys(rowHeights).forEach((r) => {
      worksheet.getRow(Number(r)).height = rowHeights[Number(r)];
    });

    const MATOME_ROW = 17;
    worksheet.getRow(MATOME_ROW).height = 120;

    const cellMatomeTitle = worksheet.getCell(MATOME_ROW, 1);
    cellMatomeTitle.value = "まとめ";
    cellMatomeTitle.font = { bold: true, name: "Yu Gothic" };
    cellMatomeTitle.alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(MATOME_ROW, 2, MATOME_ROW, 11);
    const cellMatomeInput = worksheet.getCell(MATOME_ROW, 2);
    cellMatomeInput.alignment = {
      horizontal: "left",
      vertical: "top",
      wrapText: true
    };

    // 全体に細い罫線を適用
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber < 3) return;
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.col >= 1 && cell.col <= 11) {
          cell.border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } },
          };
        }
      });
    });

    // 各時限の区切り線を太くする
    const PERIOD_SEPARATOR_ROWS = [3, 4, 6, 8, 10, 12, 13, 15, 17];
    for (const rowNum of PERIOD_SEPARATOR_ROWS) {
      const row = worksheet.getRow(rowNum);
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.col >= 1 && cell.col <= 11) {
          cell.border = {
            top:    { style: "medium", color: { argb: "FF000000" } },
            left:   { style: "thin",   color: { argb: "FF000000" } },
            bottom: { style: "thin",   color: { argb: "FF000000" } },
            right:  { style: "thin",   color: { argb: "FF000000" } },
          };
        }
      });
    }

    worksheet.getColumn(1).width = 8;
    for (let i = 0; i < 5; i++) {
      const col = DAY_COLS[i];
      worksheet.getColumn(col).width = 11;
      worksheet.getColumn(col + 1).width = 14;
    }
    worksheet.getColumn(12).width = 5;

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${teacher}_週案_${monday}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
