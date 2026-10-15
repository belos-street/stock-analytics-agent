// assets/charts.js —— ECharts 图表样板集合
// 使用方式：复制需要的 chart 块，改数据与容器 id 即可。
// 规则：
//   1. 颜色一律从 :root CSS 变量读取，禁止硬编码色值
//   2. 每个图表必须有 figcaption 标题（写在 HTML 里）
//   3. animation: false（报告是静态文档）
//   4. 每个实例都要注册 resize 监听
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();

  var baseTooltip = {
    appendToBody: true,
    backgroundColor: '#ffffff',
    borderColor: rule,
    textStyle: { color: ink, fontSize: 13 }
  };
  var axisLabel = { color: muted, fontSize: 12 };
  var splitLine = { lineStyle: { color: rule, type: 'dashed' } };

  // ================= Chart 1：分组柱状图（对比两期/两指标） =================
  // 容器：<div class="chart-box" id="chart-profit"></div>
  var c1 = echarts.init(document.getElementById('chart-profit'), null, { renderer: 'svg' });
  c1.setOption({
    animation: false,
    tooltip: Object.assign({}, baseTooltip, { trigger: 'axis' }),
    legend: { top: 8, textStyle: { color: muted, fontSize: 12 } },
    grid: { left: 60, right: 24, top: 50, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['类别A', '类别B'],
      axisLabel: axisLabel,
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: [
      { type: 'value', name: '左轴', nameTextStyle: axisLabel, axisLabel: axisLabel, splitLine: splitLine },
      { type: 'value', name: '右轴', nameTextStyle: axisLabel, axisLabel: axisLabel, splitLine: { show: false } }
    ],
    series: [
      {
        name: '系列一', type: 'bar', barWidth: 56, data: [100, 60],
        itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: ink, fontSize: 12, fontWeight: 700 }
      },
      {
        name: '系列二', type: 'bar', barWidth: 56, data: [20, 12],
        itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: ink, fontSize: 12, fontWeight: 700 }
      }
    ]
  });

  // ================= Chart 2：横向条形图（指标一览 / 排名） =================
  // 容器：<div class="chart-box" id="chart-metrics"></div>
  var c2 = echarts.init(document.getElementById('chart-metrics'), null, { renderer: 'svg' });
  c2.setOption({
    animation: false,
    tooltip: Object.assign({}, baseTooltip, {
      trigger: 'axis',
      formatter: function (p) {
        var d = p[0];
        return d.name + '：<b>' + d.value + '</b>';
      }
    }),
    grid: { left: 130, right: 40, top: 20, bottom: 40 },
    xAxis: {
      type: 'value', name: '数值', nameTextStyle: axisLabel,
      axisLabel: axisLabel, splitLine: splitLine
    },
    yAxis: {
      type: 'category',
      data: ['指标C', '指标B', '指标A'],
      axisLabel: axisLabel,
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar',
      data: [
        { value: 30, itemStyle: { color: accent2 } },
        { value: 15, itemStyle: { color: accent } },
        { value: 10, itemStyle: { color: accent } }
      ],
      barWidth: 26,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: ink, fontSize: 12, fontWeight: 700 }
    }]
  });

  // ================= Chart 3：折线 / 面积图（时间序列） =================
  // 容器：<div class="chart-box" id="chart-trend"></div>
  var c3 = echarts.init(document.getElementById('chart-trend'), null, { renderer: 'svg' });
  c3.setOption({
    animation: false,
    tooltip: Object.assign({}, baseTooltip, { trigger: 'axis' }),
    grid: { left: 70, right: 30, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月'],
      axisLabel: axisLabel,
      axisLine: { lineStyle: { color: rule } },
      boundaryGap: true
    },
    yAxis: {
      type: 'value', name: '元', nameTextStyle: axisLabel,
      axisLabel: axisLabel,
      splitLine: splitLine
    },
    series: [{
      name: '序列名',
      type: 'line',
      data: [100, 92, 75, 72],
      smooth: false,
      symbolSize: 8,
      lineStyle: { width: 3, color: accent2 },
      itemStyle: { color: accent2 },
      areaStyle: { color: accent2 + '1a' },
      label: {
        show: true, position: 'top', color: ink, fontSize: 11, fontWeight: 700
      }
    }]
  });

  // ================= Chart 4：K 线图 + 参考线（价格类） =================
  // 容器：<div class="chart-box" id="chart-kline"></div>
  // K线数据格式：[开, 收, 低, 高]
  var kdata = [
    [44.19, 42.35, 41.75, 47.17],
    [42.33, 40.59, 39.05, 43.08],
    [35.35, 32.18, 31.90, 35.61]
  ];
  var kdates = ['8/14', '8/21', '10/15'];

  var c4 = echarts.init(document.getElementById('chart-kline'), null, { renderer: 'svg' });
  c4.setOption({
    animation: false,
    tooltip: Object.assign({}, baseTooltip, {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function (p) {
        var d = p.find(function (x) { return x.seriesName === '周K'; });
        if (!d) return '';
        var v = d.data;
        return d.name + '<br>开 ' + v[1] + ' · 收 ' + v[2] + '<br>低 ' + v[3] + ' · 高 ' + v[4];
      }
    }),
    legend: { top: 4, textStyle: { color: muted, fontSize: 12 } },
    grid: { left: 50, right: 60, top: 40, bottom: 40 },
    xAxis: {
      type: 'category', data: kdates,
      axisLabel: axisLabel,
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'value', name: '元', nameTextStyle: axisLabel,
      axisLabel: axisLabel, splitLine: splitLine
    },
    series: [
      {
        name: '周K', type: 'candlestick', data: kdata,
        itemStyle: {
          color: accent2, color0: accent,
          borderColor: accent2, borderColor0: accent
        }
      },
      {
        // 参考线（如成本线/压力线）：name 可改为任意标签
        name: '参考线', type: 'line',
        data: kdates.map(function () { return 52; }),
        symbol: 'none', lineStyle: { color: accent2, width: 2, type: 'dashed' },
        label: { show: false }
      }
    ]
  });

  // ================= resize（必须保留，每个实例一行） =================
  window.addEventListener('resize', function () {
    c1.resize();
    c2.resize();
    c3.resize();
    c4.resize();
  });
})();
