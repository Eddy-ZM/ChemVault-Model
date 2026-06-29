# ChemVault Molecule Apple App

ChemVault Molecule Apple App 是 ChemVault Molecule Studio 的 Apple 设备版本，面向 iOS、iPadOS 和 macOS 提供分子搜索、SMILES 输入、基础绘制、PDB 查看、三维结构展示和本地分子管理能力。

本文档仅说明 Apple App 的正式功能范围，不包含实现原理、代码结构、开发配置或构建流程。

## 原生多平台项目

Apple App 是原生 SwiftUI 多平台项目，不作为网站 WebView 包装使用。项目保留 Swift Package 入口，并提供 XcodeGen `project.yml` 用于生成 iOS、iPadOS 和 macOS App 目标。

- iOS/iPadOS 目标：`ChemVaultMolecule-iOS`
- macOS 目标：`ChemVaultMolecule-macOS`
- 共享源码：`Sources/ChemVaultMolecule`
- 资源目录：`Resources`
- App 配置：`Supporting`

## 支持平台

- iOS 17+
- iPadOS 17+
- macOS 14+

## 导航结构

App 提供以下主要入口：

- Search
- SMILES
- Draw
- PDB
- Library
- Account

iPhone 使用底部标签栏；iPad 和 Mac 使用侧边栏布局。

## Search 搜索

- 支持按分子名称搜索
- 支持按 PubChem CID 搜索
- 提供 Water、Ethanol、Benzene、Caffeine、Aspirin、Paracetamol、Ibuprofen、Glucose 等示例
- 搜索结果可进入分子详情页
- 分子详情页可继续加载三维结构和属性信息

## SMILES 输入

- 支持手动输入或粘贴 SMILES
- 支持多行文本编辑
- 支持常用示例快速填入
- 支持 Load Molecule 和 Clear
- 输入有效 SMILES 后可进入分子详情页

## Draw 绘制

- 支持在 Apple 设备上绘制基础分子草图
- 支持放置原子和创建单键
- 支持选择、擦除、撤销、重做和清空
- 支持 36 个常用元素选择
- 支持为简单绘制结构生成 SMILES
- 可将可识别的绘制结果发送到三维详情页

## PDB 查看

- 支持输入四位 PDB ID
- 提供 1CRN、4HHB、1BNA 等示例
- 支持加载蛋白质或核酸结构
- 加载结果可进入分子详情页查看三维结构

## 分子详情页

- 支持三维分子查看
- 支持 Ball and stick、Sphere 和 Stick 显示模式
- 支持背景切换
- 显示名称、分子式、分子量、Canonical SMILES、InChIKey、IUPAC Name、来源、PDB ID 和文件名
- 支持保存到本地 Library
- 支持分享结构摘要
- 支持复制 SMILES
- 支持导出 XYZ 文本

## Library 本地分子库

- 支持从详情页保存分子到本地列表
- 支持查看已保存分子
- 支持删除本地保存项
- 支持导入 `.mol`、`.sdf`、`.xyz`、`.pdb`、`.smi`、`.smiles` 和 `.txt`
- 导入的结构可进入分子详情页继续查看

## Account 账号与权限

- 支持 Free mode 和 Signed in 状态显示
- 显示用户名称、会员等级和可用权限
- 显示搜索、导出和保存项目额度
- 支持刷新权限
- 支持打开 ChemVault User Portal
- 支持退出登录
- 权限不可用时，App 会以 Free limited mode 继续提供可用功能

## 输入与输出能力

| 能力 | 支持情况 |
| --- | --- |
| 分子名称搜索 | 支持 |
| PubChem CID 搜索 | 支持 |
| SMILES 输入 | 支持 |
| 基础二维绘制 | 支持 |
| PDB ID 加载 | 支持 |
| 本地文件导入 | `.mol`、`.sdf`、`.xyz`、`.pdb`、`.smi`、`.smiles`、`.txt` |
| 三维查看 | 支持 |
| 本地分子库 | 支持 |
| 结构导出 | 分享摘要、复制 SMILES、导出 XYZ |

## 当前功能边界

- App 当前提供 Search、SMILES、Draw、PDB、Library 和 Account 的主要使用路径。
- Draw 适合基础结构绘制；复杂环系统、完整立体化学或高级反应编辑建议通过 Search、SMILES 或文件导入加载。
- PDB 查看适合快速结构浏览和展示；高级大分子分析能力会按版本扩展。
- 云端分子库和更完整的账号联动能力会按后续版本开放。

## 适用场景

- 在 iPhone 或 iPad 上快速查询常见分子
- 在课堂或会议中展示小分子三维结构
- 在 Mac 上整理本地常用分子
- 输入 SMILES 后快速检查结构外观
- 使用 PDB 编号查看蛋白质或核酸结构
