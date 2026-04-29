<?php

namespace App\Services\V5\ProjectProcedure;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use ZipArchive;

class ProjectProcedureExportService
{
    private const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    private const EXCEL_MIME = 'application/vnd.ms-excel; charset=UTF-8';

    public function __construct(
        private readonly ProjectProcedureAccessService $access,
        private readonly ProjectProcedurePublicShareService $publicShares,
    ) {}

    public function export(Request $request, int $procedureId): Response
    {
        [$procedure, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $format = strtolower(trim((string) $request->query('format', '')));
        if (! in_array($format, ['word', 'excel'], true)) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => [
                    'format' => ['Định dạng xuất dữ liệu chỉ hỗ trợ word hoặc excel.'],
                ],
            ], 422);
        }

        $payload = $this->publicShares->buildProcedurePayload($procedure);
        $extension = $format === 'word' ? 'docx' : 'xls';
        $filename = $this->buildFilename($payload, $extension);

        if ($format === 'word') {
            return response($this->buildWordBinary($payload), 200, [
                'Content-Type' => self::WORD_MIME,
                'Content-Disposition' => $this->contentDisposition($filename),
                'Cache-Control' => 'no-store, private',
            ]);
        }

        return response("\xEF\xBB\xBF".$this->buildExcelXml($payload), 200, [
            'Content-Type' => self::EXCEL_MIME,
            'Content-Disposition' => $this->contentDisposition($filename),
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function buildWordBinary(array $payload): string
    {
        $documentXml = $this->buildWordDocumentXml($payload);
        $tempPath = tempnam(sys_get_temp_dir(), 'procedure_export_');
        if ($tempPath === false) {
            throw new RuntimeException('Không thể tạo file tạm để xuất Word.');
        }

        $zip = new ZipArchive();
        if ($zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            @unlink($tempPath);
            throw new RuntimeException('Không thể tạo file Word.');
        }

        $zip->addFromString('[Content_Types].xml', $this->wordContentTypesXml());
        $zip->addFromString('_rels/.rels', $this->wordRelationshipsXml());
        $zip->addFromString('word/document.xml', $documentXml);
        $zip->close();

        $binary = file_get_contents($tempPath);
        @unlink($tempPath);
        if ($binary === false) {
            throw new RuntimeException('Không thể đọc file Word đã tạo.');
        }

        return $binary;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function buildWordDocumentXml(array $payload): string
    {
        $project = $payload['project'] ?? [];
        $procedure = $payload['procedure'] ?? [];
        $summary = $payload['summary'] ?? [];

        $body = $this->wordParagraph('BẢNG THỦ TỤC DỰ ÁN', true, 'center', 28);
        $body .= $this->wordParagraph('Dự án: '.$this->projectTitle($payload), true);
        $body .= $this->wordParagraph('Thủ tục: '.(string) ($procedure['procedure_name'] ?? 'Thủ tục dự án'));
        $body .= $this->wordParagraph('Tiến độ: '.(int) ($summary['overall_percent'] ?? 0).'% - Tổng bước: '.(int) ($summary['total_steps'] ?? 0));
        $body .= $this->wordParagraph('Ngày xuất: '.now()->format('d/m/Y H:i'));

        foreach (($payload['phases'] ?? []) as $phaseIndex => $phase) {
            $phaseLabel = (string) ($phase['phase_label'] ?? ('Giai đoạn '.($phaseIndex + 1)));
            $phaseSummary = $phase['summary'] ?? [];
            $body .= $this->wordParagraph(
                ($phaseIndex + 1).'. '.$phaseLabel.' ('.(int) ($phaseSummary['completed_steps'] ?? 0).'/'.(int) ($phaseSummary['total_steps'] ?? 0).' bước)',
                true,
                'left',
                22
            );
            $body .= $this->wordTable($phase['steps'] ?? []);
        }

        if (($payload['phases'] ?? []) === []) {
            $body .= $this->wordParagraph('Chưa có dữ liệu thủ tục.');
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            .'<w:body>'
            .$body
            .'<w:sectPr><w:pgSz w:w="16840" w:h="11907" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>'
            .'</w:body></w:document>';
    }

    /**
     * @param array<int, mixed> $steps
     */
    private function wordTable(array $steps): string
    {
        $headers = ['TT', 'Trình tự công việc', 'ĐV chủ trì', 'Kết quả dự kiến', 'Ngày', 'Từ ngày', 'Đến ngày', 'Tiến độ', 'Văn bản'];
        $xml = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'
            .'<w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
            .'<w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
            .'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
            .'<w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
            .'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
            .'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
            .'</w:tblBorders></w:tblPr>';

        $xml .= '<w:tr>';
        foreach ($headers as $header) {
            $xml .= $this->wordCell($header, true);
        }
        $xml .= '</w:tr>';

        foreach ($steps as $step) {
            if (! is_array($step)) {
                continue;
            }
            $documentText = trim((string) ($step['document_number'] ?? ''));
            if (! empty($step['document_date'])) {
                $documentText .= ($documentText !== '' ? ' - ' : '').$this->formatDate((string) $step['document_date']);
            }

            $xml .= '<w:tr>'
                .$this->wordCell((string) ($step['display_number'] ?? ''))
                .$this->wordCell(str_repeat('  ', (int) ($step['level'] ?? 0)).(string) ($step['step_name'] ?? ''))
                .$this->wordCell((string) ($step['lead_unit'] ?? ''))
                .$this->wordCell((string) ($step['expected_result'] ?? ''))
                .$this->wordCell((string) ($step['duration_days'] ?? ''))
                .$this->wordCell($this->formatDate((string) ($step['actual_start_date'] ?? '')))
                .$this->wordCell($this->formatDate((string) ($step['actual_end_date'] ?? '')))
                .$this->wordCell((string) ($step['progress_status_label'] ?? ''))
                .$this->wordCell($documentText)
                .'</w:tr>';
        }

        return $xml.'</w:tbl>';
    }

    private function wordParagraph(string $text, bool $bold = false, string $align = 'left', int $fontSize = 20): string
    {
        $alignXml = $align !== 'left' ? '<w:jc w:val="'.$this->xml($align).'"/>' : '';
        $boldXml = $bold ? '<w:b/>' : '';

        return '<w:p><w:pPr>'.$alignXml.'<w:spacing w:after="120"/></w:pPr><w:r><w:rPr>'.$boldXml.'<w:sz w:val="'.$fontSize.'"/></w:rPr>'
            .$this->wordText($text)
            .'</w:r></w:p>';
    }

    private function wordCell(string $text, bool $bold = false): string
    {
        $boldXml = $bold ? '<w:b/>' : '';

        return '<w:tc><w:tcPr><w:tcW w:w="1800" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr>'.$boldXml.'<w:sz w:val="18"/></w:rPr>'
            .$this->wordText($text)
            .'</w:r></w:p></w:tc>';
    }

    private function wordText(string $text): string
    {
        $parts = preg_split('/\R/u', $text) ?: [$text];
        $xml = '';
        foreach ($parts as $index => $part) {
            if ($index > 0) {
                $xml .= '<w:br/>';
            }
            $xml .= '<w:t xml:space="preserve">'.$this->xml($part).'</w:t>';
        }

        return $xml;
    }

    private function wordContentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            .'</Types>';
    }

    private function wordRelationshipsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            .'</Relationships>';
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function buildExcelXml(array $payload): string
    {
        $rows = [];
        $rows[] = $this->excelRow([['value' => 'BẢNG THỦ TỤC DỰ ÁN', 'style' => 'Title', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'Dự án: '.$this->projectTitle($payload), 'style' => 'Bold', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'Thủ tục: '.(string) (($payload['procedure'] ?? [])['procedure_name'] ?? 'Thủ tục dự án'), 'style' => 'Default', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'Ngày xuất: '.now()->format('d/m/Y H:i'), 'style' => 'Default', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([]);

        foreach (($payload['phases'] ?? []) as $phaseIndex => $phase) {
            if (! is_array($phase)) {
                continue;
            }
            $phaseSummary = $phase['summary'] ?? [];
            $rows[] = $this->excelRow([[
                'value' => ($phaseIndex + 1).'. '.(string) ($phase['phase_label'] ?? 'Giai đoạn').' ('.(int) ($phaseSummary['completed_steps'] ?? 0).'/'.(int) ($phaseSummary['total_steps'] ?? 0).' bước)',
                'style' => 'Phase',
                'mergeAcross' => 8,
            ]]);
            $rows[] = $this->excelRow([
                ['value' => 'TT', 'style' => 'Header'],
                ['value' => 'Trình tự công việc', 'style' => 'Header'],
                ['value' => 'ĐV chủ trì', 'style' => 'Header'],
                ['value' => 'Kết quả dự kiến', 'style' => 'Header'],
                ['value' => 'Ngày', 'style' => 'Header'],
                ['value' => 'Từ ngày', 'style' => 'Header'],
                ['value' => 'Đến ngày', 'style' => 'Header'],
                ['value' => 'Tiến độ', 'style' => 'Header'],
                ['value' => 'Văn bản', 'style' => 'Header'],
            ]);

            foreach (($phase['steps'] ?? []) as $step) {
                if (! is_array($step)) {
                    continue;
                }
                $documentText = trim((string) ($step['document_number'] ?? ''));
                if (! empty($step['document_date'])) {
                    $documentText .= ($documentText !== '' ? ' - ' : '').$this->formatDate((string) $step['document_date']);
                }

                $rows[] = $this->excelRow([
                    ['value' => (string) ($step['display_number'] ?? '')],
                    ['value' => str_repeat('  ', (int) ($step['level'] ?? 0)).(string) ($step['step_name'] ?? '')],
                    ['value' => (string) ($step['lead_unit'] ?? '')],
                    ['value' => (string) ($step['expected_result'] ?? '')],
                    ['value' => (string) ($step['duration_days'] ?? '')],
                    ['value' => $this->formatDate((string) ($step['actual_start_date'] ?? ''))],
                    ['value' => $this->formatDate((string) ($step['actual_end_date'] ?? ''))],
                    ['value' => (string) ($step['progress_status_label'] ?? '')],
                    ['value' => $documentText],
                ]);
            }
            $rows[] = $this->excelRow([]);
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'
            .'<?mso-application progid="Excel.Sheet"?>'
            .'<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
            .'<Styles>'
            .'<Style ss:ID="Default"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>'
            .'<Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16"/><Alignment ss:Horizontal="Center"/></Style>'
            .'<Style ss:ID="Bold"><Font ss:Bold="1"/></Style>'
            .'<Style ss:ID="Phase"><Font ss:Bold="1" ss:Color="#064E3B"/><Interior ss:Color="#E6F4F1" ss:Pattern="Solid"/></Style>'
            .'<Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>'
            .'</Styles>'
            .'<Worksheet ss:Name="Bang thu tuc"><Table>'
            .$this->excelColumns()
            .implode('', $rows)
            .'</Table></Worksheet></Workbook>';
    }

    /**
     * @param array<int, array{value:string, style?:string, mergeAcross?:int}> $cells
     */
    private function excelRow(array $cells): string
    {
        if ($cells === []) {
            return '<Row/>';
        }

        $xml = '<Row>';
        foreach ($cells as $cell) {
            $style = isset($cell['style']) ? ' ss:StyleID="'.$this->xml((string) $cell['style']).'"' : '';
            $merge = isset($cell['mergeAcross']) ? ' ss:MergeAcross="'.(int) $cell['mergeAcross'].'"' : '';
            $xml .= '<Cell'.$style.$merge.'><Data ss:Type="String">'.$this->xml((string) ($cell['value'] ?? '')).'</Data></Cell>';
        }

        return $xml.'</Row>';
    }

    private function excelColumns(): string
    {
        $widths = [48, 280, 150, 240, 60, 90, 90, 120, 160];
        $xml = '';
        foreach ($widths as $width) {
            $xml .= '<Column ss:Width="'.$width.'"/>';
        }

        return $xml;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function projectTitle(array $payload): string
    {
        $project = $payload['project'] ?? [];
        $code = trim((string) ($project['project_code'] ?? ''));
        $name = trim((string) ($project['project_name'] ?? ''));

        return trim($code.($code !== '' && $name !== '' ? ' - ' : '').$name) ?: 'Dự án';
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function buildFilename(array $payload, string $extension): string
    {
        $project = $payload['project'] ?? [];
        $code = trim((string) ($project['project_code'] ?? ''));
        $base = $code !== '' ? $code : 'du_an';
        $slug = Str::slug($base, '_');

        return 'thu_tuc_'.$slug.'_'.now()->format('Ymd_His').'.'.$extension;
    }

    private function contentDisposition(string $filename): string
    {
        $ascii = preg_replace('/[^A-Za-z0-9._-]+/', '_', Str::ascii($filename)) ?: 'thu_tuc_export';

        return 'attachment; filename="'.$ascii.'"; filename*=UTF-8\'\''.rawurlencode($filename);
    }

    private function formatDate(string $date): string
    {
        $value = trim($date);
        if ($value === '') {
            return '';
        }

        try {
            return \Illuminate\Support\Carbon::parse($value)->format('d/m/Y');
        } catch (\Throwable) {
            return $value;
        }
    }

    private function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
