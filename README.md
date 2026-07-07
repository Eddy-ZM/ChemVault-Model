# ChemVault Molecule Studio

## Windows Desktop Installer

ChemVault Model can also be packaged as a Windows desktop application with Electron.
The desktop app keeps the existing Next.js web interface and serves the exported
`out/` files from an internal local server. The app title is `ChemVault Model`.

### Install

```bash
npm install
```

### Run The Web Version

```bash
npm run dev
```

For the Cloudflare Pages preview flow:

```bash
npm run preview
```

### Run The Desktop Version Locally

```bash
npm run dev:desktop
```

This command builds the static web app, starts Electron, opens the desktop
window at `/molecule/`, and proxies `/api/chem/*` requests to the configured
model API.

### Build Windows Installer

```bash
npm run build
npm run build:desktop
```

The Windows installer and portable executable are written to:

```text
release/ChemVault-Model-Setup-0.1.0-win-x64.exe
release/ChemVault-Model-Portable-0.1.0-win-x64.exe
```

The desktop API proxy defaults to:

```text
https://model.chemvault.science/api/chem
```

Desktop sign-in requests are proxied to:

```text
https://user.chemvault.science
```

Override it when needed:

```powershell
$env:CHEMVAULT_MODEL_API_URL="https://model.chemvault.science/api/chem"
$env:CHEMVAULT_USER_ORIGIN="https://user.chemvault.science"
npm run build:desktop
```

Windows EXE builds should be run on Windows. Non-Windows machines should use
the included GitHub Actions workflow or run the build on a Windows computer.

### Quantum Calculation Strategy

ChemVault Model separates quantum-related features by platform:

- Web: browser-side approximate standard for partial charges, dipole vector,
  and charge separation. It uses an iterative EEM/Gasteiger-style model and is
  clearly labeled as an approximation.
- Windows desktop app: professional local quantum calculation through
  xTB GFN2-xTB, with single-point analysis and optional geometry optimization.
- Windows desktop app: external engine port for user-licensed Gaussian and ORCA
  installations. ChemVault generates input files, runs the configured local
  executable, and parses output for energy, dipole moment, and Mulliken charges.
- Apple app: no required quantum engine integration for this project stage.

The Windows desktop app checks for xTB in this order:

```text
CHEMVAULT_XTB_PATH
Bundled installer resource: desktop/quantum/xtb/
System PATH
```

To ship xTB inside the installer, place the complete Windows xTB runtime under:

```text
desktop/quantum/xtb/
```

Then run:

```bash
npm run build:desktop
```

The professional calculation panel appears only in the Windows desktop app and
reports GFN2-xTB total energy, xTB population charges, molecular dipole moment,
run mode, and calculation logs for loaded 3D structures. If xTB is not installed
or bundled, the app shows the missing engine status instead of pretending to run
a professional calculation.

For commercial quantum chemistry software, ChemVault provides a local external
engine port instead of bundling licensed software. In the desktop calculation
panel, choose Gaussian or ORCA, select the executable path, set method, basis
set, and route options, then save the port. Users are responsible for having a
valid local license and installation for any commercial engine they connect.

### GitHub Actions

`.github/workflows/build-windows.yml` builds the web app, Windows installer,
and portable EXE on `windows-latest`, then uploads the executable artifacts as:

```text
ChemVault-Model-Windows
```

### Desktop Notes

- Electron is used because this repository is a Next.js static export and the
  current Windows setup already uses Node/npm; Tauri would require an additional
  Rust toolchain.
- 3Dmol is copied from the npm package into `public/vendor/3Dmol-min.js` before
  web or desktop builds, then exported into `out/vendor/`.
- The existing browser file input, canvas drawing, WebGL viewer, navigation,
  styling, and Cloudflare deployment flow are preserved.
- Windows code signing and NSIS installer signing are not configured. Add a
  signing certificate later if a signed installer is required.

ChemVault Molecule Studio 是 ChemVault 的分子结构查看、建模输入和三维可视化工具。当前包含网站端 Molecule Studio，以及面向 iOS、iPadOS 和 macOS 的 Apple App。

本文档仅说明网站和 App 的正式功能范围，不包含实现原理、代码结构、部署流程或开发配置。

## 功能总览

- 按分子名称或 PubChem CID 搜索化合物
- 输入或粘贴 SMILES 字符串
- 使用二维绘图工具构建基础分子结构
- 上传或导入常见分子结构文件
- 按 PDB ID 加载蛋白质或核酸结构
- 查看三维结构、分子属性和结构标识符
- 调整三维显示模式、背景、氢原子和原子标签
- 导出结构文件或三维视图图片
- 通过账号入口访问个人资料、分子库和设置相关页面

## 网站功能

网站端主入口为：

- 首页：`/`
- 分子工作台：`/molecule`
- 生产访问地址：`https://model.chemvault.science/molecule`

### 工作台布局

网站端采用左右分区工作流。

- 2D Input Workspace：选择输入方式、编辑结构、搜索分子或上传文件。
- 3D Output Workspace：查看三维结构、显示属性、调整渲染方式并执行导出。

用户可以通过任意输入方式加载结构，再在同一个三维输出区继续查看和导出。

### Search 搜索

- 支持分子名称搜索，例如 water、ethanol、benzene、caffeine、aspirin
- 支持 PubChem CID 搜索，例如 2244
- 支持常用示例快速加载
- 搜索结果可直接载入三维查看器
- 可显示名称、CID、分子式、分子量、SMILES、InChI 和 InChIKey 等信息

### SMILES 输入

- 支持手动输入或粘贴 SMILES
- 支持常见 SMILES 与芳香环 SMILES
- 提供 Load SMILES、Clear、Copy SMILES 等操作
- 内置常用示例，便于快速加载测试结构
- 加载后可进入三维查看、属性查看和文件导出流程

### Draw 绘制

- 支持选择、移动、擦除和清空画布
- 支持单键、双键、三键、芳香键、楔形键和虚线键
- 支持在画布上放置原子、拖拽延伸键和点击修改键类型
- 支持常用元素选择和完整周期表选择
- 支持撤销、重做、复制 SMILES 和下载 MOL 文件
- 支持环模板，包括环丙烷、环丁烷、环戊烷、环己烷、苯、吡啶、呋喃和噻吩
- 支持官能团模板，包括 OH、NH2、COOH、CHO、NO2、OMe、Acetyl 和 Phenyl
- 支持将可识别的绘制结果生成 SMILES，并进一步生成三维模型

### Upload 上传

- 支持拖放上传或文件选择上传
- 网站端单个文件上限为 8 MB
- 支持 `.mol`、`.sdf`、`.xyz`、`.pdb`、`.cif`、`.smi`、`.smiles` 和 `.txt`
- SMILES 文本文件会读取首个有效结构字符串
- 结构文件加载后可直接进入三维查看器

### PDB 结构加载

- 支持四位 PDB ID，例如 1CRN、4HHB、1BNA
- 可显示 PDB 标题、实验方法和分辨率等可用元数据
- PDB 结构可使用适合大分子查看的显示模式

### 三维查看器

- 支持小分子、上传结构和 PDB 结构查看
- 支持 Ball and stick、Stick、Sphere、Line、Cartoon、Surface 和 Space-filling 显示模式
- 支持浅色、深色和透明背景
- 支持显示或隐藏氢原子
- 支持显示或隐藏原子标签
- 支持重置视角
- 支持导出当前三维视图为 PNG 图片

### 结构详情与属性

Structure Details 面板用于查看当前结构的标识符和分子属性。

- 名称、来源、CID、PDB ID、文件名
- 分子式、分子量、精确质量
- SMILES、InChI、InChIKey
- LogP、TPSA
- 氢键供体、氢键受体
- 可旋转键数量、环数量、重原子数量、形式电荷
- 支持复制关键结构标识符

### 导出功能

- SMILES
- Molfile
- SDF
- XYZ
- PDB
- PNG 三维视图图片

导出按钮会根据当前已加载的数据自动启用或禁用，避免导出空结构。

### 账号入口

网站端可以匿名使用 Molecule Studio 核心功能。账号入口用于连接 ChemVault 用户系统和个人空间功能。

- 未登录用户可使用搜索、SMILES、绘制、上传、PDB、三维查看和导出
- 顶部提供 Sign in 和 Create account 入口
- 登录后显示用户头像、名称或邮箱
- 用户菜单包含 Profile、My Molecules、Settings 和 Sign out
- Profile、My Molecules 和 Settings 是账号空间入口，部分账户联动能力会按版本逐步开放

## Apple App 功能

ChemVault Molecule Apple App 面向 Apple 设备提供原生应用体验。

### 支持平台

- iOS 17+
- iPadOS 17+
- macOS 14+

### 导航结构

Apple App 提供以下主入口：

- Search
- SMILES
- Draw
- PDB
- Library
- Account

iPhone 使用底部标签栏；iPad 和 Mac 使用侧边栏布局，便于在功能模块之间切换。

### Search 搜索

- 支持按分子名称或 CID 搜索
- 支持 Water、Ethanol、Benzene、Caffeine、Aspirin、Paracetamol、Ibuprofen、Glucose 等示例
- 搜索结果可进入分子详情页
- 详情页可继续加载三维结构和分子属性

### SMILES 输入

- 支持多行文本输入
- 支持常用示例快速填入
- 支持 Load Molecule 和 Clear
- 输入有效 SMILES 后可进入分子详情页和三维查看流程

### Draw 绘制

- 支持放置原子和创建单键
- 支持选择、擦除、撤销、重做和清空
- 支持 36 个常用元素选择
- 支持为简单绘制结构生成 SMILES
- 可将可识别的绘制结果发送到三维详情页

### PDB 加载

- 支持输入四位 PDB ID
- 提供 1CRN、4HHB、1BNA 等示例
- 加载后可进入分子详情页查看三维结构

### 分子详情页

- 支持三维分子查看
- 支持 Ball and stick、Sphere 和 Stick 显示模式
- 支持背景切换
- 显示名称、分子式、分子量、Canonical SMILES、InChIKey、IUPAC Name、来源、PDB ID 和文件名
- 支持保存到本地 Library
- 支持分享结构摘要
- 支持复制 SMILES
- 支持导出 XYZ 文本

### Library 本地分子库

- 支持从详情页保存分子到本地列表
- 支持查看已保存分子
- 支持删除本地保存项
- 支持导入 `.mol`、`.sdf`、`.xyz`、`.pdb`、`.smi`、`.smiles` 和 `.txt`
- 导入的结构可进入分子详情页继续查看

### Account 账号与权限

- 支持 Free mode 和 Signed in 状态显示
- 显示用户名称、会员等级和可用权限
- 显示搜索、导出和保存项目额度
- 支持刷新权限
- 支持打开 ChemVault User Portal
- 支持退出登录
- 权限不可用时，App 会以 Free limited mode 继续提供可用功能

## 输入与输出能力对照

| 能力 | 网站端 | Apple App |
| --- | --- | --- |
| 分子名称搜索 | 支持 | 支持 |
| PubChem CID 搜索 | 支持 | 支持 |
| SMILES 输入 | 支持 | 支持 |
| 二维绘制 | 支持完整网站绘图工作流 | 支持基础原生绘图工作流 |
| PDB ID 加载 | 支持 | 支持 |
| 文件上传或导入 | `.mol`、`.sdf`、`.xyz`、`.pdb`、`.cif`、`.smi`、`.smiles`、`.txt` | `.mol`、`.sdf`、`.xyz`、`.pdb`、`.smi`、`.smiles`、`.txt` |
| 三维查看 | 支持 | 支持 |
| 属性查看 | 支持 | 支持 |
| 本地分子库 | 账号空间入口已预留 | 支持本地保存 |
| 结构导出 | SMILES、Molfile、SDF、XYZ、PDB、PNG | 分享摘要、复制 SMILES、导出 XYZ |

## 当前功能边界

- 网站端核心分子工作台无需登录即可使用。
- 网站端 My Molecules、Profile 和 Settings 为账号空间入口，部分账户联动能力按后续版本开放。
- 网站端绘图功能适合基础结构、常见环模板和常用官能团；复杂稠环、完整立体化学或高级反应编辑建议使用 Search、SMILES 或文件上传方式加载。
- Apple App 当前提供 Search、SMILES、Draw、PDB、Library 和 Account 的主要使用路径；复杂绘制和高级三维显示能力会按版本扩展。

## 适用场景

- 化学学习中的分子结构搜索、查看和演示
- 小分子 SMILES 的快速三维可视化
- PDB 结构的快速加载与展示
- 分子文件在常见格式之间的查看和导出
- 课堂、实验记录或文档中的三维结构截图准备
- Apple 设备上的移动分子查看和本地分子收藏
