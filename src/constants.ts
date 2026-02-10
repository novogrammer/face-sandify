export const IS_DEBUG = true;

export const ENABLE_FORCE_WEBGL=false;
export const SHOW_COMPUTE_WGSL_CODE=false;
export const SHOW_RENDER_WGSL_CODE=false;

export const SAND_SIMULATOR_WIDTH=128*4;
export const SAND_SIMULATOR_HEIGHT=128*4;
// 60の倍数
export const ITERATION_PER_SEC=60*4;

export const DELTA_TIME_MAX=1/30;
export const CAPTURE_CYCLE_DURATION=5;
export const SAND_TTL_MIN=10;
export const SAND_TTL_MAX=20;
export const IGNORE_SAND_TTL=true;
export const SAND_SPACING=2;
export const DIR_SWAP_PERIOD=8;

// 砂を一定間隔で全消去する周期（秒）
export const CLEAR_CYCLE_DURATION=15;
// フィールド（壁・シンク）プリセットの数
export const FIELD_COUNT=7;
// クリア毎にフィールドを切り替えるかどうか
export const ALTERNATE_FIELD_ON_CLEAR=true;


// 一辺の個数
export const FOREGROUND_GRID_RESOLUTION=32;
// 一辺の長さ
export const FOREGROUND_GRID_SIZE=1;

export const UV_SCALE = 1.5;


export const FOV_MAX = 30;

export const CAMERA_Z = FOREGROUND_GRID_SIZE/(Math.tan(FOV_MAX*0.5*Math.PI/180)*2);
