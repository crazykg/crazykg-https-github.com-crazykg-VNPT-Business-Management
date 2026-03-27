const { execSync } = require('child_process');
const path = require('path');

const projectPath = 'C:\\Users\\pchgi\\Documents\\code\\qlcv2';

const tasks = [
    "Tao docs/businesses.md - Doc backend models, controllers, routes, frontend components, services va tao tai lieu chi tiet cho module Businesses",
    "Tao docs/contracts.md - Doc code va tao tai lieu chi tiet cho module Contracts",
    "Tao docs/customers.md - Doc code va tao tai lieu chi tiet cho module Customers",
    "Tao docs/products.md - Doc code va tao tai lieu chi tiet cho module Products",
    "Tao docs/projects.md - Doc code va tao tai lieu chi tiet cho module Projects",
    "Cap nhat 6 skills con lai (departments, employees, fee-collection, revenue-mgmt, crc, support-master) - Bo sung workflow 5 buoc",
    "Tao 6 docs files con lai (departments, employees, fee-collection, revenue-mgmt, crc, support-master.md)",
    "Test va tich hop workflow - Test workflow 5 buoc voi businesses.skill pilot, verify docs va CODE_BASE_HE_THONG.md duoc cap nhat"
];

console.log('Bat dau tao tasks con lai...\n');

tasks.forEach((prompt, index) => {
    try {
        const cmd = `C:\\nvm4w\\nodejs\\node.exe C:\\nvm4w\\nodejs\\node_modules\\kanban\\dist\\cli.js task create --prompt "${prompt}" --project-path "${projectPath}"`;
        console.log(`[${index + 1}/${tasks.length}] Dang tao task`);
        execSync(cmd, { stdio: 'inherit', timeout: 10000 });
        console.log('=> Thanh cong\n');
    } catch (error) {
        console.error(`=> That bai`);
        console.error(error.message);
    }
});

console.log('Hoan thanh!');