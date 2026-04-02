<?php

namespace Database\Seeders;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Workflow Definition Seeder
 * 
 * Creates default workflow "LUONG_A" with existing transitions
 * from the current workflow_transitions table.
 * 
 * Usage:
 *   php artisan db:seed --class=WorkflowDefinitionSeeder
 */
class WorkflowDefinitionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            // ======================================================================
            // Create default workflow "LUONG_A"
            // ======================================================================
            $workflowA = WorkflowDefinition::create([
                'code' => 'LUONG_A',
                'name' => 'Luồng xử lý A',
                'description' => 'Luồng xử lý tiêu chuẩn cho Customer Request',
                'process_type' => 'customer_request',
                'workflow_group' => 'default',
                'version' => '1.0',
                'is_active' => true,
                'is_default' => true,
                'config' => [
                    'notification_rules' => [
                        'on_transition' => true,
                        'on_completion' => true,
                        'notify_performer' => true,
                        'notify_creator' => false,
                    ],
                    'sla_config' => [
                        'enabled' => false,
                        'default_sla_hours' => 48,
                        'escalation_threshold_hours' => 72,
                    ],
                    'ui_config' => [
                        'color_scheme' => 'blue',
                        'icon' => 'workflow',
                        'display_order' => 1,
                    ],
                    'validation_rules' => [
                        'require_performer' => true,
                        'require_estimated_hours' => true,
                        'allow_self_assignment' => false,
                    ],
                ],
                'metadata' => [
                    'created_from' => 'seeder',
                    'import_source' => 'existing_transitions',
                    'migration_date' => now()->toIso8601String(),
                ],
                'created_by' => 1, // Admin user
                'activated_by' => 1,
                'activated_at' => now(),
            ]);

            echo "✓ Created workflow: LUONG_A (ID: {$workflowA->id})\n";

            // ======================================================================
            // Seed transitions from existing data
            // ======================================================================
            $this->seedTransitions($workflowA);

            echo "✓ Seeded transitions for LUONG_A\n";
            echo "✓ Total transitions: " . $workflowA->transitions()->count() . "\n";
        });
    }

    /**
     * Seed transitions for workflow
     * 
     * @param WorkflowDefinition $workflow
     */
    protected function seedTransitions(WorkflowDefinition $workflow): void
    {
        // ======================================================================
        // Transition data from existing workflow matrix
        // Source: luong_xu_ly_QL_YC_khach_hang.md
        // ======================================================================
        $transitions = [
            // ----------------------------------------------------------------------
            // Từ trạng thái "Tiếp nhận" (new_intake)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'new_intake',
                'from_status_name_vi' => 'Tiếp nhận',
                'to_status_code' => 'assigned_to_receiver',
                'to_status_name_vi' => 'Giao R thực hiện',
                'allowed_roles' => ['all'],
                'required_fields' => ['performer_user_id'],
                'is_auto_transition' => false,
                'sort_order' => 10,
                'transition_config' => [
                    'notifications' => [
                        'send_email' => true,
                        'recipients' => ['performer'],
                    ],
                ],
            ],
            [
                'from_status_code' => 'new_intake',
                'from_status_name_vi' => 'Tiếp nhận',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['all'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 20,
                'transition_config' => null,
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "Giao R thực hiện" (assigned_to_receiver)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'assigned_to_receiver',
                'from_status_name_vi' => 'Giao R thực hiện',
                'to_status_code' => 'receiver_in_progress',
                'to_status_name_vi' => 'R Đang thực hiện',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 30,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'assigned_to_receiver',
                'from_status_name_vi' => 'Giao R thực hiện',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 40,
                'transition_config' => null,
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "Giao PM/Trả YC cho PM" (pending_dispatch)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'not_executed',
                'to_status_name_vi' => 'Không tiếp nhận',
                'allowed_roles' => ['A'],
                'required_fields' => ['notes'],
                'is_auto_transition' => false,
                'sort_order' => 50,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'waiting_customer_feedback',
                'to_status_name_vi' => 'Chờ khách hàng cung cấp thông tin',
                'allowed_roles' => ['A'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 60,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'assigned_to_receiver',
                'to_status_name_vi' => 'Giao R thực hiện',
                'allowed_roles' => ['A'],
                'required_fields' => ['performer_user_id'],
                'is_auto_transition' => false,
                'sort_order' => 70,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'analysis',
                'to_status_name_vi' => 'Chuyển BA Phân tích',
                'allowed_roles' => ['A'],
                'required_fields' => ['performer_user_id', 'analysis_notes'],
                'is_auto_transition' => false,
                'sort_order' => 80,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'dms_transfer',
                'to_status_name_vi' => 'Chuyển DMS',
                'allowed_roles' => ['A'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 90,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'coding',
                'to_status_name_vi' => 'Lập trình',
                'allowed_roles' => ['A'],
                'required_fields' => ['performer_user_id', 'technical_specs'],
                'is_auto_transition' => false,
                'sort_order' => 100,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'pending_dispatch',
                'from_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'to_status_code' => 'completed',
                'to_status_name_vi' => 'Hoàn thành',
                'allowed_roles' => ['A'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 110,
                'transition_config' => null,
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "Hoàn thành" (completed)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'completed',
                'from_status_name_vi' => 'Hoàn thành',
                'to_status_code' => 'assigned_to_receiver',
                'to_status_name_vi' => 'Giao R thực hiện',
                'allowed_roles' => ['A'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 120,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'completed',
                'from_status_name_vi' => 'Hoàn thành',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['all'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 130,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'completed',
                'from_status_name_vi' => 'Hoàn thành',
                'to_status_code' => 'customer_notified',
                'to_status_name_vi' => 'Thông báo khách hàng',
                'allowed_roles' => ['all'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 140,
                'transition_config' => [
                    'notifications' => [
                        'send_email' => true,
                        'send_push' => true,
                        'recipients' => ['customer', 'creator'],
                    ],
                ],
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "R Đang thực hiện" (receiver_in_progress)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'receiver_in_progress',
                'from_status_name_vi' => 'R Đang thực hiện',
                'to_status_code' => 'completed',
                'to_status_name_vi' => 'Hoàn thành',
                'allowed_roles' => ['R'],
                'required_fields' => ['work_summary'],
                'is_auto_transition' => false,
                'sort_order' => 150,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'receiver_in_progress',
                'from_status_name_vi' => 'R Đang thực hiện',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['R'],
                'required_fields' => ['notes'],
                'is_auto_transition' => false,
                'sort_order' => 160,
                'transition_config' => null,
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "Chuyển BA Phân tích" (analysis)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'analysis',
                'from_status_name_vi' => 'Chuyển BA Phân tích',
                'to_status_code' => 'analysis_completed',
                'to_status_name_vi' => 'Chuyển BA Phân tích hoàn thành',
                'allowed_roles' => ['R'],
                'required_fields' => ['analysis_document'],
                'is_auto_transition' => false,
                'sort_order' => 170,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'analysis',
                'from_status_name_vi' => 'Chuyển BA Phân tích',
                'to_status_code' => 'analysis_suspended',
                'to_status_name_vi' => 'Chuyển BA Phân tích tạm ngưng',
                'allowed_roles' => ['R'],
                'required_fields' => ['suspension_reason'],
                'is_auto_transition' => false,
                'sort_order' => 180,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'analysis',
                'from_status_name_vi' => 'Chuyển BA Phân tích',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 190,
                'transition_config' => null,
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "Chuyển BA Phân tích hoàn thành" (analysis_completed)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'analysis_completed',
                'from_status_name_vi' => 'Chuyển BA Phân tích hoàn thành',
                'to_status_code' => 'dms_transfer',
                'to_status_name_vi' => 'Chuyển DMS',
                'allowed_roles' => ['all'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 200,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'analysis_completed',
                'from_status_name_vi' => 'Chuyển BA Phân tích hoàn thành',
                'to_status_code' => 'coding',
                'to_status_name_vi' => 'Lập trình',
                'allowed_roles' => ['all'],
                'required_fields' => ['performer_user_id'],
                'is_auto_transition' => false,
                'sort_order' => 210,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'analysis_completed',
                'from_status_name_vi' => 'Chuyển BA Phân tích hoàn thành',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 220,
                'transition_config' => null,
            ],

            // ----------------------------------------------------------------------
            // Từ trạng thái "Chuyển BA Phân tích tạm ngưng" (analysis_suspended)
            // ----------------------------------------------------------------------
            [
                'from_status_code' => 'analysis_suspended',
                'from_status_name_vi' => 'Chuyển BA Phân tích tạm ngưng',
                'to_status_code' => 'analysis',
                'to_status_name_vi' => 'Chuyển BA Phân tích',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 230,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'analysis_suspended',
                'from_status_name_vi' => 'Chuyển BA Phân tích tạm ngưng',
                'to_status_code' => 'analysis_completed',
                'to_status_name_vi' => 'Chuyển BA Phân tích hoàn thành',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 240,
                'transition_config' => null,
            ],
            [
                'from_status_code' => 'analysis_suspended',
                'from_status_name_vi' => 'Chuyển BA Phân tích tạm ngưng',
                'to_status_code' => 'pending_dispatch',
                'to_status_name_vi' => 'Giao PM/Trả YC cho PM',
                'allowed_roles' => ['R'],
                'required_fields' => [],
                'is_auto_transition' => false,
                'sort_order' => 250,
                'transition_config' => null,
            ],
        ];

        // Insert all transitions
        foreach ($transitions as $transitionData) {
            WorkflowTransition::create(array_merge($transitionData, [
                'workflow_definition_id' => $workflow->id,
                'process_type' => $workflow->process_type,
                'workflow_group' => $workflow->workflow_group,
                'is_active' => true,
                'created_by' => 1,
            ]));
        }
    }
}
