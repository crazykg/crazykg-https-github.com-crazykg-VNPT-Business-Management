<?php

namespace App\Http\Controllers\Api\V5;

use App\Services\V5\ProjectProcedure\ProjectProcedureAttachmentService;
use App\Services\V5\ProjectProcedure\ProjectProcedureLifecycleService;
use App\Services\V5\ProjectProcedure\ProjectProcedureRaciService;
use App\Services\V5\ProjectProcedure\ProjectProcedureStepService;
use App\Services\V5\ProjectProcedure\ProjectProcedureTemplateService;
use App\Services\V5\ProjectProcedure\ProjectProcedureWorklogService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectProcedureController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProjectProcedureTemplateService $templates,
        private readonly ProjectProcedureLifecycleService $lifecycle,
        private readonly ProjectProcedureStepService $steps,
        private readonly ProjectProcedureWorklogService $worklogs,
        private readonly ProjectProcedureRaciService $raci,
        private readonly ProjectProcedureAttachmentService $attachments,
    ) {
        parent::__construct($support, $accessAudit);
    }

    public function templates(): JsonResponse
    {
        return $this->templates->templates();
    }

    public function templateSteps(int $templateId): JsonResponse
    {
        return $this->templates->templateSteps($templateId);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        return $this->templates->storeTemplate($request);
    }

    public function updateTemplate(Request $request, int $id): JsonResponse
    {
        return $this->templates->updateTemplate($request, $id);
    }

    public function deleteTemplate(int $id): JsonResponse
    {
        return $this->templates->deleteTemplate($id);
    }

    public function storeTemplateStep(Request $request, int $templateId): JsonResponse
    {
        return $this->templates->storeTemplateStep($request, $templateId);
    }

    public function updateTemplateStep(Request $request, int $templateId, int $stepId): JsonResponse
    {
        return $this->templates->updateTemplateStep($request, $templateId, $stepId);
    }

    public function deleteTemplateStep(int $templateId, int $stepId): JsonResponse
    {
        return $this->templates->deleteTemplateStep($templateId, $stepId);
    }

    public function deleteTemplateSteps(Request $request, int $templateId): JsonResponse
    {
        return $this->templates->deleteTemplateSteps($request, $templateId);
    }

    public function importTemplateSteps(Request $request, int $templateId): JsonResponse
    {
        return $this->templates->importTemplateSteps($request, $templateId);
    }

    public function projectProcedures(int $projectId, Request $request): JsonResponse
    {
        return $this->lifecycle->projectProcedures($projectId, $request);
    }

    public function createProcedure(Request $request, int $projectId): JsonResponse
    {
        return $this->lifecycle->createProcedure($request, $projectId);
    }

    public function resyncProcedure(Request $request, int $procedureId): JsonResponse
    {
        return $this->lifecycle->resyncProcedure($request, $procedureId);
    }

    public function procedureSteps(int $procedureId, Request $request): JsonResponse
    {
        return $this->steps->procedureSteps($procedureId, $request);
    }

    public function updateStep(Request $request, int $stepId): JsonResponse
    {
        return $this->steps->updateStep($request, $stepId);
    }

    public function batchUpdateSteps(Request $request): JsonResponse
    {
        return $this->steps->batchUpdateSteps($request);
    }

    public function addCustomStep(Request $request, int $procedureId): JsonResponse
    {
        return $this->steps->addCustomStep($request, $procedureId);
    }

    public function deleteStep(int $stepId, Request $request): JsonResponse
    {
        return $this->steps->deleteStep($stepId, $request);
    }

    public function updatePhaseLabel(Request $request, int $procedureId): JsonResponse
    {
        return $this->lifecycle->updatePhaseLabel($request, $procedureId);
    }

    public function stepWorklogs(int $stepId, Request $request): JsonResponse
    {
        return $this->worklogs->stepWorklogs($stepId, $request);
    }

    public function addWorklog(Request $request, int $stepId): JsonResponse
    {
        return $this->worklogs->addWorklog($request, $stepId);
    }

    public function updateWorklog(Request $request, int $logId): JsonResponse
    {
        return $this->worklogs->updateWorklog($request, $logId);
    }

    public function reorderSteps(Request $request): JsonResponse
    {
        return $this->steps->reorderSteps($request);
    }

    public function procedureWorklogs(int $procedureId, Request $request): JsonResponse
    {
        return $this->worklogs->procedureWorklogs($procedureId, $request);
    }

    public function updateIssueStatus(Request $request, int $issueId): JsonResponse
    {
        return $this->worklogs->updateIssueStatus($request, $issueId);
    }

    public function getRaci(int $procedureId, Request $request): JsonResponse
    {
        return $this->raci->getRaci($procedureId, $request);
    }

    public function addRaci(Request $request, int $procedureId): JsonResponse
    {
        return $this->raci->addRaci($request, $procedureId);
    }

    public function removeRaci(int $raciId, Request $request): JsonResponse
    {
        return $this->raci->removeRaci($raciId, $request);
    }

    public function getStepRaciBulk(int $procedureId, Request $request): JsonResponse
    {
        return $this->raci->getStepRaciBulk($procedureId, $request);
    }

    public function getStepRaci(int $stepId, Request $request): JsonResponse
    {
        return $this->raci->getStepRaci($stepId, $request);
    }

    public function setStepRaci(Request $request, int $stepId): JsonResponse
    {
        return $this->raci->setStepRaci($request, $stepId);
    }

    public function batchSetStepRaci(Request $request, int $procedureId): JsonResponse
    {
        return $this->raci->batchSetStepRaci($request, $procedureId);
    }

    public function removeStepRaci(int $raciId, Request $request): JsonResponse
    {
        return $this->raci->removeStepRaci($raciId, $request);
    }

    public function stepAttachments(int $stepId, Request $request): JsonResponse
    {
        return $this->attachments->stepAttachments($stepId, $request);
    }

    public function linkStepAttachment(Request $request, int $stepId): JsonResponse
    {
        return $this->attachments->linkStepAttachment($request, $stepId);
    }

    public function deleteStepAttachment(Request $request, int $stepId, int $attachmentId): JsonResponse
    {
        return $this->attachments->deleteStepAttachment($request, $stepId, $attachmentId);
    }
}
