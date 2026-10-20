/**
 * 华南理工大学数学学院常见专业课预设。
 * 侧重点仅作提示词参考，不声称对应任何官方教学大纲，一切以资料为准。
 */
export const COURSES = [
  {
    id: 'math-analysis',
    name: '数学分析',
    hint: '极限与连续、微分中值定理、Taylor 展开、不定积分与定积分、级数、多元微积分、含参变量积分',
  },
  {
    id: 'linear-algebra',
    name: '高等代数',
    hint: '行列式、矩阵运算、线性空间与线性变换、特征值、Jordan 标准形、二次型、欧氏空间',
  },
  {
    id: 'analytic-geometry',
    name: '解析几何',
    hint: '向量代数、平面与直线、二次曲面、坐标变换、正交变换',
  },
  {
    id: 'ode',
    name: '常微分方程',
    hint: '一阶方程初等解法、线性方程组、解的存在唯一性、高阶线性方程、稳定性与相图',
  },
  {
    id: 'complex',
    name: '复变函数',
    hint: '解析函数、Cauchy 积分公式、级数展开、留数定理、共形映射',
  },
  {
    id: 'real-analysis',
    name: '实变函数',
    hint: '测度与可测函数、Lebesgue 积分、收敛定理、Lp 空间、Riesz 表示',
  },
  {
    id: 'probability',
    name: '概率论与数理统计',
    hint: '随机变量与分布、数字特征、大数定律与中心极限定理、参数估计、假设检验',
  },
  {
    id: 'algebra',
    name: '抽象代数',
    hint: '群、环、域、同态与同构、正规子群与商群、Sylow 定理、域扩张与 Galois 理论初步',
  },
  {
    id: 'diff-geometry',
    name: '微分几何',
    hint: '曲线论、曲率与挠率、曲面第一/第二基本形式、Gauss 曲率、测地线',
  },
  {
    id: 'numerical',
    name: '数值分析',
    hint: '插值与逼近、数值积分、线性方程组迭代法、非线性方程求根、误差与稳定性',
  },
  {
    id: 'pde',
    name: '偏微分方程',
    hint: '波动方程、热方程、Laplace 方程、分离变量法、特征线法、能量方法',
  },
  {
    id: 'discrete',
    name: '离散数学',
    hint: '集合与关系、图论、数理逻辑、组合计数、递推与生成函数',
  },
  {
    id: 'custom',
    name: '其他课程',
    hint: '自定义课程名称与复习侧重点',
  },
]

export const DEFAULT_COURSE = 'math-analysis'

export function getCourse(id) {
  return COURSES.find((c) => c.id === id) || COURSES[COURSES.length - 1]
}

export function courseName(id, customName = '') {
  if (id === 'custom') return customName.trim() || '专业课'
  return getCourse(id).name
}
