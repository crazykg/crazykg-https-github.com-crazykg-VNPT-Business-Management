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
    private const EXPORT_AGENCY_PARENT = 'TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM';
    private const EXPORT_AGENCY_NAME = 'VNPT CẦN THƠ';
    private const EXPORT_ISSUE_PLACE = 'Cần Thơ';
    private const WORD_PAGE_WIDTH_LANDSCAPE = 16840;
    private const WORD_PAGE_HEIGHT_LANDSCAPE = 11907;
    private const WORD_MARGIN_TOP = 1134; // 20 mm
    private const WORD_MARGIN_RIGHT = 850; // 15 mm
    private const WORD_MARGIN_BOTTOM = 1134; // 20 mm
    private const WORD_MARGIN_LEFT = 1701; // 30 mm
    private const WORD_FONT_FAMILY = 'Times New Roman';
    private const WORD_TABLE_WIDTH = 14280;
    private const WORD_TABLE_COLUMN_WIDTHS = [520, 3400, 1400, 2600, 760, 1220, 1220, 1300, 1860];

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
        $procedure = $payload['procedure'] ?? [];
        $summary = $payload['summary'] ?? [];
        $phases = $payload['phases'] ?? [];

        $body = $this->wordAdministrativeHeader();
        $body .= $this->wordParagraph($this->administrativeDateDisplay(), false, 'right', 26, true, 160);
        $body .= $this->wordParagraph('BẢNG THỦ TỤC DỰ ÁN', true, 'center', 28, false, 80, 160);
        $body .= $this->wordParagraph('Dự án: '.$this->projectTitle($payload), true, 'center', 26, false, 80);
        $body .= $this->wordParagraph('Thủ tục: '.(string) ($procedure['procedure_name'] ?? 'Thủ tục dự án'), true, 'center', 26, false, 80);
        $body .= $this->wordParagraph('Tiến độ: '.(int) ($summary['overall_percent'] ?? 0).'% - Tổng bước: '.(int) ($summary['total_steps'] ?? 0), false, 'center', 26, false, 160);

        if ($phases !== []) {
            $body .= $this->wordTable($phases);
        } else {
            $body .= $this->wordParagraph('Chưa có dữ liệu thủ tục.');
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            .'<w:body>'
            .$body
            .'<w:sectPr>'
            .'<w:pgSz w:w="'.self::WORD_PAGE_WIDTH_LANDSCAPE.'" w:h="'.self::WORD_PAGE_HEIGHT_LANDSCAPE.'" w:orient="landscape"/>'
            .'<w:pgMar w:top="'.self::WORD_MARGIN_TOP.'" w:right="'.self::WORD_MARGIN_RIGHT.'" w:bottom="'.self::WORD_MARGIN_BOTTOM.'" w:left="'.self::WORD_MARGIN_LEFT.'" w:header="360" w:footer="360" w:gutter="0"/>'
            .'</w:sectPr>'
            .'</w:body></w:document>';
    }

    /**
     * @param array<int, mixed> $phases
     */
    private function wordTable(array $phases): string
    {
        $headers = ['TT', 'Trình tự công việc', 'ĐV chủ trì', 'Kết quả dự kiến', 'Ngày', 'Từ ngày', 'Đến ngày', 'Tiến độ', 'Văn bản'];
        $xml = '<w:tbl><w:tblPr><w:tblW w:w="'.self::WORD_TABLE_WIDTH.'" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>'
            .'<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            .'<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            .'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            .'<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            .'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            .'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            .'</w:tblBorders><w:tblCellMar>'
            .'<w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>'
            .'</w:tblCellMar></w:tblPr><w:tblGrid>';

        foreach (self::WORD_TABLE_COLUMN_WIDTHS as $width) {
            $xml .= '<w:gridCol w:w="'.$width.'"/>';
        }

        $xml .= '</w:tblGrid>';

        $xml .= '<w:tr>';
        foreach ($headers as $index => $header) {
            $xml .= $this->wordCell($header, true, 'center', self::WORD_TABLE_COLUMN_WIDTHS[$index] ?? 1200, 24, 1, true);
        }
        $xml .= '</w:tr>';

        foreach ($phases as $phaseIndex => $phase) {
            if (! is_array($phase)) {
                continue;
            }
            $phaseLabel = (string) ($phase['phase_label'] ?? ('Giai đoạn '.($phaseIndex + 1)));
            $phaseSummary = $phase['summary'] ?? [];
            $xml .= '<w:tr>'
                .$this->wordCell(
                    ($phaseIndex + 1).'. '.$phaseLabel.' ('.(int) ($phaseSummary['completed_steps'] ?? 0).'/'.(int) ($phaseSummary['total_steps'] ?? 0).' bước)',
                    true,
                    'left',
                    self::WORD_TABLE_WIDTH,
                    24,
                    count(self::WORD_TABLE_COLUMN_WIDTHS)
                )
                .'</w:tr>';

            foreach (($phase['steps'] ?? []) as $step) {
                if (! is_array($step)) {
                    continue;
                }
                $documentText = trim((string) ($step['document_number'] ?? ''));
                if (! empty($step['document_date'])) {
                    $documentText .= ($documentText !== '' ? ' - ' : '').$this->formatDate((string) $step['document_date']);
                }

                $xml .= '<w:tr>'
                    .$this->wordCell((string) ($step['display_number'] ?? ''), false, 'center', self::WORD_TABLE_COLUMN_WIDTHS[0], 24, 1, true)
                    .$this->wordCell(str_repeat('  ', (int) ($step['level'] ?? 0)).(string) ($step['step_name'] ?? ''), false, 'left', self::WORD_TABLE_COLUMN_WIDTHS[1])
                    .$this->wordCell((string) ($step['lead_unit'] ?? ''), false, 'left', self::WORD_TABLE_COLUMN_WIDTHS[2])
                    .$this->wordCell((string) ($step['expected_result'] ?? ''), false, 'left', self::WORD_TABLE_COLUMN_WIDTHS[3])
                    .$this->wordCell((string) ($step['duration_days'] ?? ''), false, 'center', self::WORD_TABLE_COLUMN_WIDTHS[4], 24, 1, true)
                    .$this->wordCell($this->formatDate((string) ($step['actual_start_date'] ?? '')), false, 'center', self::WORD_TABLE_COLUMN_WIDTHS[5], 24, 1, true)
                    .$this->wordCell($this->formatDate((string) ($step['actual_end_date'] ?? '')), false, 'center', self::WORD_TABLE_COLUMN_WIDTHS[6], 24, 1, true)
                    .$this->wordCell((string) ($step['progress_status_label'] ?? ''), false, 'center', self::WORD_TABLE_COLUMN_WIDTHS[7])
                    .$this->wordCell($documentText, false, 'left', self::WORD_TABLE_COLUMN_WIDTHS[8])
                    .'</w:tr>';
            }
        }

        return $xml.'</w:tbl>';
    }

    private function wordParagraph(
        string $text,
        bool $bold = false,
        string $align = 'left',
        int $fontSize = 26,
        bool $italic = false,
        int $after = 120,
        int $before = 0
    ): string
    {
        $alignXml = $align !== 'left' ? '<w:jc w:val="'.$this->xml($align).'"/>' : '';

        return '<w:p><w:pPr>'.$alignXml.'<w:spacing w:before="'.$before.'" w:after="'.$after.'"/></w:pPr><w:r>'
            .$this->wordRunProperties($bold, $italic, $fontSize)
            .$this->wordText($text)
            .'</w:r></w:p>';
    }

    private function wordCell(
        string $text,
        bool $bold = false,
        string $align = 'left',
        int $width = 1800,
        int $fontSize = 24,
        int $gridSpan = 1,
        bool $noWrap = false
    ): string
    {
        $alignXml = $align !== 'left' ? '<w:jc w:val="'.$this->xml($align).'"/>' : '';
        $gridSpanXml = $gridSpan > 1 ? '<w:gridSpan w:val="'.$gridSpan.'"/>' : '';
        $noWrapXml = $noWrap ? '<w:noWrap/>' : '';

        return '<w:tc><w:tcPr><w:tcW w:w="'.$width.'" w:type="dxa"/>'.$gridSpanXml.$noWrapXml.'<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr>'.$alignXml.'<w:spacing w:after="0"/></w:pPr><w:r>'
            .$this->wordRunProperties($bold, false, $fontSize)
            .$this->wordText($text)
            .'</w:r></w:p></w:tc>';
    }

    private function wordAdministrativeHeader(): string
    {
        return '<w:tbl><w:tblPr><w:tblW w:w="'.self::WORD_TABLE_WIDTH.'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>'
            .'<w:tblGrid><w:gridCol w:w="6080"/><w:gridCol w:w="8200"/></w:tblGrid><w:tr>'
            .$this->wordHeaderCell([
                ['text' => self::EXPORT_AGENCY_PARENT, 'bold' => false, 'fontSize' => 24, 'after' => 0],
                ['text' => self::EXPORT_AGENCY_NAME, 'bold' => true, 'fontSize' => 24, 'after' => 0],
                ['text' => '────────────', 'bold' => false, 'fontSize' => 18, 'after' => 0],
            ], 6080)
            .$this->wordHeaderCell([
                ['text' => 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'bold' => true, 'fontSize' => 24, 'after' => 0],
                ['text' => 'Độc lập - Tự do - Hạnh phúc', 'bold' => true, 'fontSize' => 26, 'after' => 0],
                ['text' => '────────────', 'bold' => false, 'fontSize' => 18, 'after' => 0],
            ], 8200)
            .'</w:tr></w:tbl>';
    }

    /**
     * @param array<int, array{text:string, bold?:bool, italic?:bool, fontSize?:int, after?:int}> $paragraphs
     */
    private function wordHeaderCell(array $paragraphs, int $width): string
    {
        $xml = '<w:tc><w:tcPr><w:tcW w:w="'.$width.'" w:type="dxa"/></w:tcPr>';
        foreach ($paragraphs as $paragraph) {
            $xml .= $this->wordParagraph(
                (string) $paragraph['text'],
                (bool) ($paragraph['bold'] ?? false),
                'center',
                (int) ($paragraph['fontSize'] ?? 24),
                (bool) ($paragraph['italic'] ?? false),
                (int) ($paragraph['after'] ?? 0)
            );
        }

        return $xml.'</w:tc>';
    }

    private function wordRunProperties(bool $bold = false, bool $italic = false, int $fontSize = 26): string
    {
        return '<w:rPr>'
            .'<w:rFonts w:ascii="'.self::WORD_FONT_FAMILY.'" w:hAnsi="'.self::WORD_FONT_FAMILY.'" w:eastAsia="'.self::WORD_FONT_FAMILY.'" w:cs="'.self::WORD_FONT_FAMILY.'"/>'
            .($bold ? '<w:b/>' : '')
            .($italic ? '<w:i/>' : '')
            .'<w:color w:val="000000"/>'
            .'<w:sz w:val="'.$fontSize.'"/>'
            .'</w:rPr>';
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
        $procedure = $payload['procedure'] ?? [];
        $summary = $payload['summary'] ?? [];
        $rows = [];
        $rows[] = $this->excelRow([
            ['value' => self::EXPORT_AGENCY_PARENT, 'style' => 'AdminCenter', 'mergeAcross' => 3],
            ['value' => 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'style' => 'AdminCenterBold', 'mergeAcross' => 4],
        ]);
        $rows[] = $this->excelRow([
            ['value' => self::EXPORT_AGENCY_NAME, 'style' => 'AdminCenterBold', 'mergeAcross' => 3],
            ['value' => 'Độc lập - Tự do - Hạnh phúc', 'style' => 'AdminCenterBold', 'mergeAcross' => 4],
        ]);
        $rows[] = $this->excelRow([
            ['value' => '────────────', 'style' => 'AdminCenter', 'mergeAcross' => 3],
            ['value' => '────────────', 'style' => 'AdminCenter', 'mergeAcross' => 4],
        ]);
        $rows[] = $this->excelRow([]);
        $rows[] = $this->excelRow([['value' => $this->administrativeDateDisplay(), 'style' => 'DateLine', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'BẢNG THỦ TỤC DỰ ÁN', 'style' => 'Title', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'Dự án: '.$this->projectTitle($payload), 'style' => 'Subtitle', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'Thủ tục: '.(string) ($procedure['procedure_name'] ?? 'Thủ tục dự án'), 'style' => 'Subtitle', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([['value' => 'Tiến độ: '.(int) ($summary['overall_percent'] ?? 0).'% - Tổng bước: '.(int) ($summary['total_steps'] ?? 0), 'style' => 'MetaCenter', 'mergeAcross' => 8]]);
        $rows[] = $this->excelRow([]);
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

            foreach (($phase['steps'] ?? []) as $step) {
                if (! is_array($step)) {
                    continue;
                }
                $documentText = trim((string) ($step['document_number'] ?? ''));
                if (! empty($step['document_date'])) {
                    $documentText .= ($documentText !== '' ? ' - ' : '').$this->formatDate((string) $step['document_date']);
                }

                $rows[] = $this->excelRow([
                    ['value' => (string) ($step['display_number'] ?? ''), 'style' => 'CellCenter'],
                    ['value' => str_repeat('  ', (int) ($step['level'] ?? 0)).(string) ($step['step_name'] ?? ''), 'style' => 'Cell'],
                    ['value' => (string) ($step['lead_unit'] ?? ''), 'style' => 'Cell'],
                    ['value' => (string) ($step['expected_result'] ?? ''), 'style' => 'Cell'],
                    ['value' => (string) ($step['duration_days'] ?? ''), 'style' => 'CellCenter'],
                    ['value' => $this->formatDate((string) ($step['actual_start_date'] ?? '')), 'style' => 'CellCenter'],
                    ['value' => $this->formatDate((string) ($step['actual_end_date'] ?? '')), 'style' => 'CellCenter'],
                    ['value' => (string) ($step['progress_status_label'] ?? ''), 'style' => 'CellCenter'],
                    ['value' => $documentText, 'style' => 'Cell'],
                ]);
            }
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'
            .'<?mso-application progid="Excel.Sheet"?>'
            .'<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
            .'<Styles>'
            .$this->excelStyles()
            .'</Styles>'
            .'<Worksheet ss:Name="Bang thu tuc"><Table ss:DefaultRowHeight="18">'
            .$this->excelColumns()
            .implode('', $rows)
            .'</Table>'
            .$this->excelWorksheetOptions()
            .'</Worksheet></Workbook>';
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
        $widths = [48, 270, 140, 230, 70, 110, 110, 120, 180];
        $xml = '';
        foreach ($widths as $width) {
            $xml .= '<Column ss:Width="'.$width.'"/>';
        }

        return $xml;
    }

    private function excelStyles(): string
    {
        $font = '<Font ss:FontName="Times New Roman" ss:Size="13" ss:Color="#000000"/>';
        $boldFont = '<Font ss:FontName="Times New Roman" ss:Size="13" ss:Color="#000000" ss:Bold="1"/>';
        $tableBorders = '<Borders>'
            .'<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
            .'<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
            .'<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
            .'<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
            .'</Borders>';

        return '<Style ss:ID="Default"><Alignment ss:Vertical="Top" ss:WrapText="1"/>'.$font.'</Style>'
            .'<Style ss:ID="AdminCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'.$font.'</Style>'
            .'<Style ss:ID="AdminCenterBold"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'.$boldFont.'</Style>'
            .'<Style ss:ID="DateLine"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Times New Roman" ss:Size="13" ss:Color="#000000" ss:Italic="1"/></Style>'
            .'<Style ss:ID="Title"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Times New Roman" ss:Size="14" ss:Color="#000000" ss:Bold="1"/></Style>'
            .'<Style ss:ID="Subtitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'.$boldFont.'</Style>'
            .'<Style ss:ID="MetaCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'.$font.'</Style>'
            .'<Style ss:ID="Phase"><Alignment ss:Vertical="Center" ss:WrapText="1"/>'.$boldFont.$tableBorders.'</Style>'
            .'<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'.$boldFont.$tableBorders.'</Style>'
            .'<Style ss:ID="Cell"><Alignment ss:Vertical="Top" ss:WrapText="1"/>'.$font.$tableBorders.'</Style>'
            .'<Style ss:ID="CellCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Top" ss:WrapText="1"/>'.$font.$tableBorders.'</Style>';
    }

    private function excelWorksheetOptions(): string
    {
        return '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">'
            .'<PageSetup>'
            .'<Layout x:Orientation="Landscape"/>'
            .'<PageMargins x:Top="0.79" x:Bottom="0.79" x:Left="1.18" x:Right="0.59"/>'
            .'</PageSetup>'
            .'<FitToPage/>'
            .'<Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight><PaperSizeIndex>9</PaperSizeIndex></Print>'
            .'</WorksheetOptions>';
    }

    private function administrativeDateDisplay(): string
    {
        $date = now();

        return sprintf(
            '%s, ngày %s tháng %s năm %s',
            self::EXPORT_ISSUE_PLACE,
            $date->format('d'),
            $date->format('m'),
            $date->format('Y')
        );
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
