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
      'site', 'building', 'road', 'paths', 'rotations', 'trees', 'facilities',
      'guestBeds', 'herbs', 'lawn', 'objects', 'groundFeatures',
      'groundFeatureGuides', 'labels', 'guides', 'crowns'
    ],

    // 起動時のカメラプリセット名（既存のカメラプリセット関数名を文字列で参照）
    defaultCamera: 'bird',

    // トップバーに出すKPI（既存の #siteArea #northArea #fieldArea 等のdd要素idを流用）
    kpis: ['siteArea', 'northArea', 'fieldArea'],
  },
  exterior: {
    id: 'exterior',
    label: '宅地・外構',
    sections: [
      'overview', 'walkthrough', 'camera', 'displayMode', 'sun', 'atmosphere', 'north',
      'appearance', 'parking', 'guides', 'measure', 'siteInfo', 'project', 'dataPolicy'
    ],
    layers: ['site', 'building', 'road', 'parking', 'guides', 'exteriorGuides'],
    defaultCamera: 'birdNE',
    kpis: ['siteArea', 'northArea']
  }
};

window.ACTIVE_WORKSPACE = 'field';
