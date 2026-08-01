// js/workspaces.js
window.WORKSPACES = {
  field: {
    id: 'field',
    label: '畑レイアウト',

    // このワークスペースで表示するpanelセクションのid（index.html側 data-section と対応）
    sections: [
      'overview', 'experienceView', 'walkthrough', 'camera', 'displayMode',
      'sun', 'atmosphere', 'north',
      'season', 'growthYear', 'plantingDensity', 'cropPattern', 'phenology',
      'landscapeLayers', 'guides', 'groundEdit', 'objectEdit', 'plantEdit',
      'measure', 'siteInfo', 'boundaryAdjustment', 'planAB', 'project', 'dataPolicy'
    ],

    // 表示するThree.jsグループ名（groups.xxx と対応。既存 groups 定義に準拠）
    layers: [
      'site', 'building', 'paths', 'rotation', 'trees',
      'facilities', 'guestGarden', 'herbs', 'lawn', 'labels', 'guides'
    ],

    // 起動時のカメラプリセット名（既存のカメラプリセット関数名を文字列で参照）
    defaultCamera: 'bird',

    // トップバーに出すKPI（既存の #siteArea #northArea #fieldArea 等のdd要素idを流用）
    kpis: ['siteArea', 'northArea', 'fieldArea'],
  }

  // Phase 2以降、ここに exterior: {...} を追加する。
  // sections/layers/kpisの型が同じなので、追加時に他ワークスペースへの影響はない。
};

window.ACTIVE_WORKSPACE = 'field'; // Phase 1では常にfield固定
