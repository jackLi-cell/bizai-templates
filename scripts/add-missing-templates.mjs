import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'data');

const existing = JSON.parse(readFileSync(join(DATA, 'templates.json'), 'utf-8'));

const newTemplates = [
// === BAKERY (8 templates) ===
{id:"bakery-new-product",title:"烘焙新品推广文案",slug:"bakery-new-product",industry:"bakery",task:"campaign-copy",description:"为面包店或蛋糕房的新品上市撰写推广文案",scenario:"新品上架、季节限定款发布时使用",notFor:"不适合用于食品安全标签",materialsNeeded:["新品名称","口味特点","价格","限定信息"],prompt:"你是一位烘焙店文案助手。请为以下新品撰写推广文案。\n\n新品名称：{新品名称}\n口味特点：{口味描述}\n主要原料：{原料亮点}\n价格：{价格}\n限定信息：{是否限量或限时}\n购买方式：{到店/外卖/预订}\n\n要求：\n1. 字数60-100字\n2. 有食欲感\n3. 突出原料或工艺亮点\n4. 不使用绝对化用语\n5. 适合朋友圈或小红书",fieldExplanations:{"新品名称":"新品叫什么","口味描述":"什么口味","原料亮点":"用了什么好原料","价格":"多少钱","是否限量或限时":"有没有限制","到店/外卖/预订":"怎么买"},outputFormat:"60-100字推广文案",exampleOutput:"新品｜伯爵红茶磅蛋糕，用的是正宗伯爵茶粉，切开能闻到茶香。口感扎实湿润，配黑咖啡刚好。每天限量20个，卖完就没了。38元/个，到店自取或外卖都行（仅供格式参考）",reviewChecklist:["确认产品信息准确","检查价格正确","确认原料描述真实","没有绝对化用语"],relatedTemplates:["bakery-product-desc","bakery-seasonal"]},
// SPLIT_MARKER_1
];

const allTemplates = [...existing, ...newTemplates];
writeFileSync(join(DATA, 'templates.json'), JSON.stringify(allTemplates, null, 2), 'utf-8');
console.log(`Done! Total: ${allTemplates.length} templates`);
