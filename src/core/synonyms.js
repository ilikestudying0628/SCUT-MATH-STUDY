/**
 * 数学术语的同义扩展。
 * DeepSeek 没有 embedding，BM25 对「收不收敛」「留数怎么算」这类口语问法容易漏召回，
 * 这里用一张手写术语表在检索阶段做查询扩展。
 */

const GROUPS = [
  ['极限', '趋于', '趋近', 'lim', 'limit'],
  ['连续', '连续性', '一致连续', '间断点'],
  ['导数', '可导', '可微', '微分', '求导', 'derivative'],
  ['中值定理', '拉格朗日', '罗尔', '柯西', 'rolle', 'lagrange', 'cauchy', '费马'],
  ['积分', '原函数', '不定积分', '定积分', '换元', '分部积分', '牛顿莱布尼茨'],
  ['级数', '收敛', '发散', '敛散性', '判别法', '幂级数', '泰勒', '傅里叶'],
  ['留数', '奇点', '极点', '洛朗', '罗朗', 'residue', 'laurent'],
  ['复变', '解析函数', '柯西黎曼', '共形', '保角'],
  ['矩阵', '行列式', '秩', '特征值', '特征向量', '若尔当', 'jordan', '相似', '二次型', '线性空间'],
  ['概率', '随机变量', '分布函数', '期望', '方差', '大数定律', '中心极限', '假设检验', '置信区间'],
  ['测度', '可测', '勒贝格', 'lebesgue', '几乎处处', '控制收敛', '单调收敛'],
  ['微分方程', '常微分', '通解', '特解', '初值', '稳定性', '相图'],
  ['偏微分', '波动方程', '热方程', '拉普拉斯', '分离变量', '特征线'],
  ['数值分析', '插值', '迭代', '误差', '收敛阶', '牛顿法', '龙格库塔'],
  ['群', '子群', '正规子群', '商群', '同态', '同构', 'sylow', '环', '理想', '域扩张', 'galois'],
  ['拓扑', '开集', '闭集', '紧致', '连通', '同胚'],
  ['数理统计', '参数估计', '极大似然', '区间估计'],
  ['解析几何', '向量', '平面', '直线', '二次曲面'],
  ['微分几何', '曲率', '挠率', '测地线', '第一基本形式'],
]

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** 找出查询里命中的术语组 */
export function matchAliasGroups(query) {
  const q = normalize(query)
  if (!q) return []
  return GROUPS.filter((group) => group.some((term) => q.includes(normalize(term))))
}

/**
 * 返回可用于扩展查询的词（已去重）。
 * @param {string} query
 * @param {{maxGroups?: number, exclude?: string[]}} [options]
 */
export function expandQueryText(query, options = {}) {
  const { maxGroups = 3, exclude = [] } = options
  const excluded = new Set(exclude.map(normalize))
  const terms = new Set()
  for (const group of matchAliasGroups(query).slice(0, maxGroups)) {
    for (const term of group) {
      const key = normalize(term)
      if (!excluded.has(key)) terms.add(term)
    }
  }
  return [...terms]
}
