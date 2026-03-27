const { execSync } = require('child_process');
const path = require('path');

const projectPath = 'C:\\Users\\pchgi\\Documents\\code\\qlcv2';
const kanbanCli = 'C:\\nvm4w\\nodejs\\node.exe C:\\nvm4w\\nodejs\\node_modules\\kanban\\dist\\cli.js';

const tasks = [
    {
        name: "Task 1: Chuan bi",
        prompt: "Chuan bi - Nghien cuu init-he-thong.md, kiem tra script update-codebase-docs.js, verify CODE_BASE_HE_THONG.md, doc 11 skill files, tao template skill va docs files voi workflow 5 buoc"
    },
    {
        name: "Task 2: Update businesses.skill",
        prompt: "Cap nhat businesses.skill - Bo sung workflow 5 buoc, them reference docs/businesses.md va CODE_BASE_HE_THONG.md, cap nhat permissions va lich su cap nhat"
    },
    {
        name: "Task 3: Update contracts.skill",
        prompt: "Cap nhat contracts.skill - Bo sung workflow 5 buoc, them reference docs/contracts.md va CODE_BASE_HE_THONG.md"
    },
    {
        name: "Task 4: Update customers.skill",
        prompt: "Cap nhat customers.skill - Bo sung workflow 5 buoc, them reference docs/customers.md va CODE_BASE_HE_THONG.md"
    },
    {
        name: "Task 5: Update products.skill",
        prompt: "Cap nhat products.skill - Bo sung workflow 5 buoc, them reference docs/products.md va CODE_BASE_HE_THONG.md"
    },
    {
        name: "Task 6: Update projects.skill",
        prompt: "Cap nhat projects.skill - Bo sung workflow 5 buoc, them reference docs/projects.md va CODE_BASE_HE_THONG.md"
    },
    {
        name: "Task 7: Tao docs/businesses.md",
        prompt: "Tao docs/businesses.md - Doc backend models, controllers, routes, frontend components, services va tao tai lieu chi tiet cho module Businesses"
    },
    {
        name: "Task 8: Tao docs/contracts.md",
        prompt: "Tao docs/contracts.md - Doc code va tao tai lieu chi tiet cho module Contracts"
    },
    {
        name: "Task 9: Tao docs/customers.md",
        prompt: "Tao docs/customers.md - Doc code va tao tai lieu chi tiet cho module Customers"
    },
    {
        name: "Task 10: Tao docs/products.md",
        prompt: "Tao docs/products.md - Doc code va tao tai lieu chi tiet cho module Products"
    },
    {
        name: "Task 11: Tao docs/projects.md",
        prompt: "Tao docs/projects.md - Doc code va tao tai lieu chi tiet cho module Projects"
    },
    {
        name: "Task 12: Update 6 skills con lai",
        prompt: "Cap nhat 6 skills con lai (departments, employees, fee-collection, revenue-mgmt, crc, support-master) - Bo sung workflow 5 buoc"
    },
    {
        name: "Task 13: Tao 6 docs con lai",
        prompt: "Tao 6 docs files con lai (departments, employees, fee-collection, revenue-mgmt, crc, support-master.md)"
    },
    {
        name: "Task 14: Test va tich hop",
        prompt: "Test va tich hop workflow - Test workflow 5 buoc voi businesses.skill pilot, verify docs va CODE_BASE_HE_THONG.md duoc cap nhat, ap dung cho tat ca skills"
    }
];

console.log('Bat dau tao tasks...\n');

tasks.forEach((task, index) => {
    try {
        const cmd = `C:\\nvm4w\\nodejs\\node.exe C:\\nvm4w\\nodejs\\node_modules\\kanban\\dist\\cli.js task create --prompt "${task.prompt}" --project-path "${projectPath}"`;
        console.log(`[${index + 1}/${tasks.length}] Dang tao: ${task.name}`);
        execSync(cmd, { stdio: 'inherit' });
        console.log('=> Thanh cong\n');
    } catch (error) {
        console.error(`=> That bai khi tao task: ${task.name}`);
        console.error(error.message);
    }
});

console.log('Hoan thanh tao tasks!');