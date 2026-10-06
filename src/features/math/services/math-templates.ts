/**
 * Bảng công thức bấm-chèn dành cho giáo viên.
 *
 * Phần lớn người soạn đề không viết mã LaTeX, nên công thức được đưa ra dưới dạng NÚT BẤM:
 * mỗi mẫu đã render sẵn bằng KaTeX kèm tên tiếng Việt, bấm là chèn vào nguồn đang soạn.
 *
 * Quy ước dữ liệu:
 * - `latex`: nguồn chèn vào (có thể chỉnh tiếp bằng tay).
 * - `select`: đoạn "chỗ trống" của mẫu (ví dụ `a` trong `\frac{a}{b}`). Sau khi chèn, đoạn này
 *   được bôi đen để gõ thay ngay; nếu trước đó người dùng đang bôi đen nội dung khác thì nội
 *   dung đó được đưa vào đúng chỗ trống.
 * - `block`: công thức hiển thị riêng một dòng (tổng, tích phân, giới hạn, ma trận, hệ phương
 *   trình, phản ứng hoá học) thay vì nằm trong dòng.
 */
export interface MathTemplate {
  id: string;
  /** Nhãn hiển thị bằng tiếng Việt, không dùng thuật ngữ LaTeX. */
  label: string;
  latex: string;
  block?: boolean;
  select?: string;
}

export interface MathTemplateGroup {
  id: string;
  label: string;
  templates: readonly MathTemplate[];
}

/**
 * Các nhóm công thức hiển thị thành từng thẻ (tab) trong hộp thoại "Chèn công thức".
 * Mọi mẫu ở đây đều được kiểm thử render bằng KaTeX (`math-templates.test.ts`) nên không thể
 * thêm mẫu sai cú pháp mà không bị phát hiện.
 */
export const MATH_TEMPLATE_GROUPS: readonly MathTemplateGroup[] = [
  {
    id: "basic",
    label: "Phân số, luỹ thừa, căn",
    templates: [
      { id: "frac", label: "Phân số", latex: "\\frac{a}{b}", select: "a" },
      { id: "power", label: "Luỹ thừa", latex: "a^{n}", select: "a" },
      { id: "subscript", label: "Chỉ số dưới", latex: "a_{n}", select: "a" },
      { id: "sqrt", label: "Căn bậc hai", latex: "\\sqrt{a}", select: "a" },
      { id: "sqrt-n", label: "Căn bậc n", latex: "\\sqrt[n]{a}", select: "n" },
      { id: "abs", label: "Giá trị tuyệt đối", latex: "\\left| a \\right|", select: "a" },
      {
        id: "parentheses",
        label: "Ngoặc đơn",
        latex: "\\left( a + b \\right)",
        select: "a",
      },
      { id: "power-ten", label: "Luỹ thừa của 10", latex: "10^{n}", select: "n" },
      { id: "percent", label: "Phần trăm", latex: "a\\%", select: "a" },
    ],
  },
  {
    id: "analysis",
    label: "Hàm số & giải tích",
    templates: [
      { id: "quadratic", label: "Hàm số bậc hai", latex: "y = ax^2 + bx + c" },
      { id: "rational", label: "Hàm phân thức", latex: "y = \\frac{ax + b}{cx + d}" },
      { id: "derivative", label: "Đạo hàm", latex: "f'(x) = \\frac{a}{b}", select: "a" },
      {
        id: "integral",
        label: "Tích phân xác định",
        latex: "\\int_{a}^{b} f(x)\\,dx",
        block: true,
        select: "a",
      },
      { id: "antiderivative", label: "Nguyên hàm", latex: "\\int f(x)\\,dx", block: true },
      { id: "sum", label: "Tổng", latex: "\\sum_{i=1}^{n} a_i", block: true, select: "n" },
      {
        id: "limit",
        label: "Giới hạn",
        latex: "\\lim_{x \\to a} f(x)",
        block: true,
        select: "a",
      },
      { id: "log", label: "Lôgarit", latex: "\\log_{a} b", select: "a" },
      { id: "ln", label: "Lôgarit tự nhiên", latex: "\\ln x" },
      { id: "exp", label: "Hàm số mũ", latex: "e^{x}", select: "x" },
      { id: "arithmetic", label: "Cấp số cộng", latex: "u_{n} = u_{1} + (n - 1)d" },
      { id: "geometric", label: "Cấp số nhân", latex: "u_{n} = u_{1} q^{n - 1}" },
    ],
  },
  {
    id: "trigonometry",
    label: "Lượng giác",
    templates: [
      { id: "sin", label: "Sin", latex: "\\sin x" },
      { id: "cos", label: "Cos", latex: "\\cos x" },
      { id: "tan", label: "Tang", latex: "\\tan x" },
      { id: "cot", label: "Cotang", latex: "\\cot x" },
      {
        id: "trig-identity",
        label: "Hằng đẳng thức lượng giác",
        latex: "\\sin^2 x + \\cos^2 x = 1",
      },
      { id: "trig-equation", label: "Phương trình lượng giác", latex: "\\sin x = \\frac{1}{2}" },
      { id: "double-angle", label: "Công thức nhân đôi", latex: "\\cos 2x = 1 - 2\\sin^2 x" },
      { id: "alpha", label: "Góc alpha", latex: "\\alpha" },
      { id: "beta", label: "Góc beta", latex: "\\beta" },
      { id: "phi", label: "Góc phi", latex: "\\varphi" },
      { id: "pi", label: "Số pi", latex: "\\pi" },
      { id: "degree", label: "Độ", latex: "30^{\\circ}" },
    ],
  },
  {
    id: "geometry",
    label: "Hình học & vectơ",
    templates: [
      { id: "vector", label: "Vectơ", latex: "\\vec{AB}" },
      { id: "vector-length", label: "Độ dài vectơ", latex: "\\left| \\vec{AB} \\right|" },
      { id: "vector-coordinate", label: "Toạ độ vectơ", latex: "\\vec{u} = (x; y)" },
      { id: "angle", label: "Góc", latex: "\\angle ABC" },
      { id: "triangle", label: "Tam giác", latex: "\\triangle ABC" },
      { id: "parallel", label: "Song song", latex: "a \\parallel b" },
      { id: "perpendicular", label: "Vuông góc", latex: "a \\perp b" },
      { id: "circle", label: "Đường tròn", latex: "(O; R)" },
      {
        id: "line-equation",
        label: "Phương trình đường thẳng",
        latex: "Ax + By + C = 0",
      },
      {
        id: "circle-equation",
        label: "Phương trình đường tròn",
        latex: "(x - a)^2 + (y - b)^2 = R^2",
      },
      {
        id: "triangle-area",
        label: "Diện tích tam giác",
        latex: "S = \\frac{1}{2} a h",
        select: "a",
      },
      { id: "cone-volume", label: "Thể tích hình nón", latex: "V = \\frac{1}{3} \\pi R^2 h" },
    ],
  },
  {
    id: "combinatorics",
    label: "Tổ hợp – Xác suất",
    templates: [
      { id: "permutation", label: "Chỉnh hợp", latex: "A_{n}^{k}", select: "n" },
      { id: "combination", label: "Tổ hợp", latex: "C_{n}^{k}", select: "n" },
      { id: "factorial", label: "Giai thừa", latex: "n!" },
      { id: "probability", label: "Xác suất", latex: "P(A) = \\frac{n(A)}{n(\\Omega)}" },
      {
        id: "probability-union",
        label: "Xác suất của hợp",
        latex: "P(A \\cup B) = P(A) + P(B)",
      },
    ],
  },
  {
    id: "linear",
    label: "Ma trận & hệ phương trình",
    templates: [
      {
        id: "matrix",
        label: "Ma trận",
        latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
        block: true,
        select: "a",
      },
      {
        id: "equation-system",
        label: "Hệ phương trình",
        latex: "\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}",
        block: true,
      },
    ],
  },
  {
    id: "symbols",
    label: "Ký hiệu & so sánh",
    templates: [
      { id: "le", label: "Nhỏ hơn hoặc bằng", latex: "\\le" },
      { id: "ge", label: "Lớn hơn hoặc bằng", latex: "\\ge" },
      { id: "ne", label: "Khác", latex: "\\ne" },
      { id: "approx", label: "Xấp xỉ", latex: "\\approx" },
      { id: "pm", label: "Cộng trừ", latex: "\\pm" },
      { id: "times", label: "Nhân", latex: "\\times" },
      { id: "div", label: "Chia", latex: "\\div" },
      { id: "infinity", label: "Vô cùng", latex: "\\infty" },
      { id: "in", label: "Thuộc", latex: "\\in" },
      { id: "not-in", label: "Không thuộc", latex: "\\notin" },
      { id: "subset", label: "Tập con", latex: "\\subset" },
      { id: "union", label: "Hợp", latex: "\\cup" },
      { id: "intersection", label: "Giao", latex: "\\cap" },
      { id: "empty-set", label: "Tập rỗng", latex: "\\varnothing" },
      { id: "implies", label: "Suy ra", latex: "\\Rightarrow" },
      { id: "equivalent", label: "Tương đương", latex: "\\Leftrightarrow" },
      { id: "real", label: "Tập số thực", latex: "\\mathbb{R}" },
      { id: "natural", label: "Tập số tự nhiên", latex: "\\mathbb{N}" },
      { id: "integer", label: "Tập số nguyên", latex: "\\mathbb{Z}" },
      { id: "rational-set", label: "Tập số hữu tỉ", latex: "\\mathbb{Q}" },
    ],
  },
  {
    id: "science",
    label: "Vật lí – Hoá học",
    templates: [
      { id: "velocity", label: "Vận tốc", latex: "v = \\frac{s}{t}" },
      { id: "newton-second", label: "Định luật II Newton", latex: "F = m a" },
      { id: "work", label: "Công của lực", latex: "A = F s \\cos\\alpha" },
      { id: "power-physics", label: "Công suất", latex: "P = \\frac{A}{t}" },
      { id: "kinematics", label: "Liên hệ vận tốc – quãng đường", latex: "v^2 - v_0^2 = 2 a s" },
      { id: "heat", label: "Nhiệt lượng", latex: "Q = m c \\Delta t" },
      { id: "oscillation", label: "Dao động điều hoà", latex: "x = A\\cos(\\omega t + \\varphi)" },
      { id: "concentration", label: "Nồng độ mol", latex: "C_M = \\frac{n}{V}" },
      { id: "water", label: "Nước", latex: "H_2O" },
      { id: "sulfuric-acid", label: "Axit sunfuric", latex: "H_2SO_4" },
      { id: "sulfate", label: "Ion sunfat", latex: "SO_4^{2-}" },
      { id: "iron-three", label: "Ion sắt (III)", latex: "Fe^{3+}" },
      { id: "alkane", label: "Công thức ankan", latex: "C_nH_{2n+2}", select: "n" },
      { id: "reaction", label: "Phản ứng hoá học", latex: "2H_2 + O_2 \\to 2H_2O", block: true },
    ],
  },
];

function isLetter(character: string | undefined): boolean {
  return character !== undefined && /[a-zA-Z]/.test(character);
}

/**
 * Tìm chỗ trống của mẫu trong nguồn LaTeX.
 *
 * Không thể dùng `indexOf` trực tiếp: chữ cái của chỗ trống thường xuất hiện sớm hơn bên trong
 * tên lệnh (`\f|rac`, `\be|gin`, `\a|lpha`) nên sẽ chọn nhầm vị trí. Một vị trí chỉ được coi là
 * chỗ trống khi ký tự đứng ngay trước nó không phải chữ cái và cũng không phải dấu `\`.
 */
export function findMathPlaceholder(latex: string, token: string): number {
  if (token.length === 0) {
    return -1;
  }

  let from = 0;
  for (;;) {
    const index = latex.indexOf(token, from);
    if (index < 0) {
      return -1;
    }

    const previous = index > 0 ? latex[index - 1] : undefined;
    if (!isLetter(previous) && previous !== "\\") {
      return index;
    }

    from = index + 1;
  }
}

export interface MathSourceState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Chèn một mẫu công thức vào nguồn LaTeX đang có, tại đúng vị trí con trỏ.
 *
 * - Không bôi đen gì: chèn tại con trỏ, rồi bôi đen chỗ trống của mẫu để gõ thay ngay.
 * - Có bôi đen: nội dung bôi đen được đưa vào chỗ trống đầu tiên của mẫu (bôi `x^2` rồi bấm
 *   "Căn bậc hai" → `\sqrt{x^2}`).
 * - Mẫu không có chỗ trống (ví dụ ký hiệu `\le`): con trỏ đặt ngay sau phần vừa chèn.
 *
 * Hàm thuần, không phụ thuộc DOM — nhờ vậy quy tắc chèn được kiểm thử bằng Vitest.
 */
export function insertMathTemplate(
  template: MathTemplate,
  state: MathSourceState,
): MathSourceState {
  const length = state.value.length;
  const start = Math.min(Math.max(state.selectionStart, 0), length);
  const end = Math.min(Math.max(state.selectionEnd, start), length);
  const selected = state.value.slice(start, end).trim();

  let inserted = template.latex;
  let placeholder = template.select ?? "";

  if (selected.length > 0 && placeholder.length > 0) {
    const hole = findMathPlaceholder(inserted, placeholder);
    if (hole >= 0) {
      inserted = `${inserted.slice(0, hole)}${selected}${inserted.slice(hole + placeholder.length)}`;
      placeholder = selected;
    }
  }

  const value = `${state.value.slice(0, start)}${inserted}${state.value.slice(end)}`;
  const index = findMathPlaceholder(inserted, placeholder);

  if (index < 0) {
    const caret = start + inserted.length;
    return { value, selectionStart: caret, selectionEnd: caret };
  }

  return {
    value,
    selectionStart: start + index,
    selectionEnd: start + index + placeholder.length,
  };
}
