<?php

namespace App\Services\V5\Domain;

use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;
use ZipArchive;

class ProductQuotationExportService
{
    private const SINGLE_VAT_TEMPLATE_CANDIDATES = [
        [
            'path' => '../database/template-mau/mau_bao_gia_mot_vat.docx',
            'image_relation_id' => 'rId5',
            'footer_relation_id' => 'rId3',
        ],
        [
            'path' => '../database/Baogiamau.docx',
            'image_relation_id' => 'rId8',
            'footer_relation_id' => 'rId9',
        ],
    ];
    private const MULTI_VAT_TEMPLATE_CANDIDATES = [
        [
            'path' => '../database/template-mau/mau_bao_gia_nhieu_vat.docx',
            'image_relation_id' => 'rId6',
            'footer_relation_id' => 'rId3',
        ],
        [
            'path' => '../database/VNPT_BaoGia_ChauThanh_nhieuthu.docx',
            'image_relation_id' => 'rId6',
            'footer_relation_id' => 'rId3',
        ],
    ];
    private const FALLBACK_WORD_LOGO_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR42mP8z/C/HwAFAgH/l9GdWQAAAABJRU5ErkJggg==';
    private const DUPLICATE_QUOTATION_ITEM_MESSAGE = 'Không được trùng hạng mục công việc với cùng đơn giá trong một báo giá.';

    private const DEFAULT_SCOPE_SUMMARY = 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị';

    private const DEFAULT_NOTES = [
        'Giá cước trên đã bao gồm chi phí vận hành cơ bản và các dịch vụ có liên quan.',
        'Giá cước trên chưa bao gồm chi phí tích hợp với các phần mềm khác, tuỳ chỉnh chức năng đang có, phát triển chức năng mới hoặc chuyển đổi dữ liệu.',
        'Các yêu cầu ngoài phạm vi tiêu chuẩn sẽ được khảo sát và báo giá bổ sung theo khối lượng thực tế.',
        'Báo giá có hiệu lực trong vòng 90 ngày kể từ ngày ký.',
    ];

    private const DEFAULT_CONTACT_LINE = 'Ông Phan Văn Rở - Giám đốc - Phòng Giải pháp 2 - Trung tâm Kinh doanh Giải pháp, số điện thoại: 0945.200.052./.';

    private const DEFAULT_CLOSING_MESSAGE = 'Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ rất mong nhận được sự ủng hộ từ Quý đơn vị và hân hạnh phục vụ!';

    private const DEFAULT_SIGNATORY_TITLE = 'GIÁM ĐỐC';
    private const DEFAULT_SIGNATORY_UNIT = 'TRUNG TÂM KINH DOANH GIẢI PHÁP';
    private const DEFAULT_SIGNATORY_NAME = '';

    private const WORD_PAGE_WIDTH = 11907;
    private const WORD_PAGE_HEIGHT = 16840;
    private const WORD_PAGE_MARGIN_TOP = 810;
    private const WORD_PAGE_MARGIN_RIGHT = 1134;
    private const WORD_PAGE_MARGIN_BOTTOM = 1134;
    private const WORD_PAGE_MARGIN_LEFT = 1134;
    private const WORD_PAGE_HEADER = 720;
    private const WORD_PAGE_FOOTER = 720;
    private const WORD_TEXT_WIDTH = 9639;

    private const WORD_HEADER_TABLE_GRID_WIDTHS = [2500, 6572];
    private const WORD_HEADER_LOGO_WIDTH = 1450000;
    private const WORD_HEADER_LOGO_HEIGHT = 457344;
    private const WORD_TABLE_GRID_WIDTHS = [567, 2127, 1275, 993, 1572, 1559, 1560];
    private const WORD_APPENDIX_TABLE_GRID_WIDTHS = [720, 4025, 4894];
    private const WORD_SIGNATURE_TABLE_GRID_WIDTHS = [3000, 6639];
    private const WORD_HEADER_IMAGE_RELATION_ID = 'rId8';
    private const WORD_FOOTER_RELATION_ID = 'rId9';

    private const MULTI_VAT_WORD_PAGE_MARGIN_TOP = 810;
    private const MULTI_VAT_WORD_PAGE_MARGIN_RIGHT = 1107;
    private const MULTI_VAT_WORD_PAGE_MARGIN_BOTTOM = 720;
    private const MULTI_VAT_WORD_PAGE_MARGIN_LEFT = 1440;
    private const MULTI_VAT_WORD_HEADER_TABLE_GRID_WIDTHS = [3240, 7272];
    private const MULTI_VAT_WORD_HEADER_LOGO_WIDTH = 1933575;
    private const MULTI_VAT_WORD_HEADER_LOGO_HEIGHT = 609600;
    private const MULTI_VAT_WORD_TABLE_GRID_WIDTHS = [578, 1260, 992, 912, 1356, 1497, 1480, 1542];
    private const MULTI_VAT_WORD_SIGNATURE_TABLE_GRID_WIDTHS = [2500, 6861];
    private const MULTI_VAT_WORD_HEADER_IMAGE_RELATION_ID = 'rId6';
    private const MULTI_VAT_WORD_FOOTER_RELATION_ID = 'rId3';

    private const EXCEL_COLUMN_WIDTHS = [10, 36, 18, 14, 18, 20, 42];
    private const MULTI_VAT_EXCEL_COLUMN_WIDTHS = [10, 28, 16, 14, 16, 16, 18, 30];

    public function exportWord(Request $request): Response
    {
        $quotation = $this->normalizeQuotationPayload($request->all());
        $binary = $this->buildWordBinaryFromNormalizedQuotation($quotation);
        $filename = $this->buildExportFilename($quotation['recipient_name'], $quotation['date'], 'docx');

        return response($binary, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => $this->buildContentDisposition($filename),
        ]);
    }

    public function exportPdf(Request $request): Response
    {
        $quotation = $this->normalizeQuotationPayload($request->all());
        $binary = $this->buildPdfDocumentBinary($quotation);
        $filename = $this->buildExportFilename($quotation['recipient_name'], $quotation['date'], 'pdf');

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => $this->buildContentDisposition($filename, 'inline'),
        ]);
    }

    public function exportExcel(Request $request): Response
    {
        $quotation = $this->normalizeQuotationPayload($request->all());
        $filename = $this->buildExportFilename($quotation['recipient_name'], $quotation['date'], 'xls');
        $content = "\xEF\xBB\xBF" . $this->buildExcelWorkbookXml($quotation);

        return response($content, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => $this->buildContentDisposition($filename),
        ]);
    }

    /**
     * @return array{
     *   recipient_name: string,
     *   sender_city: string,
     *   scope_summary: string,
     *   vat_rate: float,
     *   validity_days: int,
     *   notes: array<int, string>,
     *   contact_line: string,
     *   closing_message: string,
     *   signatory_title: string,
     *   signatory_unit: string,
     *   signatory_name: string,
     *   date: Carbon,
     *   date_display: string,
     *   word_date_display: string,
     *   uses_multi_vat_template: bool,
     *   subtotal: float,
     *   vat_amount: float,
     *   total: float,
     *   total_in_words: string,
     *   items: array<int, array{
     *     product_id: int|null,
     *     product_name: string,
     *     unit: string,
     *     quantity: float,
     *     unit_price: float,
     *     vat_rate: float,
     *     vat_amount: float,
     *     total_with_vat: float,
     *     line_total: float,
     *     note: string
     *   }>
     * }
     */
    public function normalizeQuotationPayload(array $payload): array
    {
        $validator = Validator::make($payload, [
            'recipient_name' => ['required', 'string', 'max:255'],
            'sender_city' => ['nullable', 'string', 'max:120'],
            'scope_summary' => ['nullable', 'string', 'max:2000'],
            'quote_date' => ['nullable', 'date'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'validity_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'notes_text' => ['nullable', 'string', 'max:8000'],
            'contact_line' => ['nullable', 'string', 'max:2000'],
            'closing_message' => ['nullable', 'string', 'max:2000'],
            'signatory_title' => ['nullable', 'string', 'max:255'],
            'signatory_unit' => ['nullable', 'string', 'max:255'],
            'signatory_name' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.product_name' => ['required', 'string', 'max:500'],
            'items.*.unit' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.note' => ['nullable', 'string', 'max:4000'],
        ]);

        $validated = $validator->validate();

        $productIds = collect($validated['items'] ?? [])
            ->pluck('product_id')
            ->filter(fn ($value): bool => $value !== null && $value !== '')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->unique()
            ->values()
            ->all();

        if ($productIds !== [] && Schema::hasTable('products')) {
            $existingIds = DB::table('products')
                ->whereIn('id', $productIds)
                ->pluck('id')
                ->map(fn ($value): int => (int) $value)
                ->all();

            $missingIds = array_values(array_diff($productIds, $existingIds));
            if ($missingIds !== []) {
                throw ValidationException::withMessages([
                    'items' => ['Không tìm thấy sản phẩm: ' . implode(', ', $missingIds) . '.'],
                ]);
            }
        }

        $defaultVatRate = round((float) ($validated['vat_rate'] ?? 10), 2);
        $items = [];
        $subtotal = 0.0;
        $vatAmount = 0.0;
        foreach ($validated['items'] as $item) {
            $quantity = round((float) $item['quantity'], 2);
            $unitPrice = round((float) $item['unit_price'], 2);
            $lineTotal = round($quantity * $unitPrice, 2);
            $itemVatRate = round((float) ($item['vat_rate'] ?? $defaultVatRate), 2);
            $itemVatAmount = round($lineTotal * ($itemVatRate / 100), 2);
            $itemTotalWithVat = round($lineTotal + $itemVatAmount, 2);
            $subtotal += $lineTotal;
            $vatAmount += $itemVatAmount;

            $items[] = [
                'product_id' => isset($item['product_id']) ? (int) $item['product_id'] : null,
                'product_name' => trim((string) $item['product_name']),
                'unit' => trim((string) ($item['unit'] ?? '')),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'vat_rate' => $itemVatRate,
                'vat_amount' => $itemVatAmount,
                'total_with_vat' => $itemTotalWithVat,
                'line_total' => $lineTotal,
                'note' => $this->normalizeMultilineText((string) ($item['note'] ?? '')),
            ];
        }

        $this->ensureNoDuplicateQuotationItems($items);

        $quoteDate = isset($validated['quote_date'])
            ? Carbon::parse($validated['quote_date'])->startOfDay()
            : Carbon::now()->startOfDay();

        $normalizedVatRateKeys = array_values(array_unique(array_map(
            fn (array $item): string => number_format((float) $item['vat_rate'], 2, '.', ''),
            $items
        )));
        $usesMultiVatTemplate = count($normalizedVatRateKeys) > 1;
        $vatRate = count($normalizedVatRateKeys) === 1
            ? round((float) $items[0]['vat_rate'], 2)
            : $defaultVatRate;
        $vatAmount = round($usesMultiVatTemplate ? $vatAmount : $subtotal * ($vatRate / 100), 2);
        $total = round($subtotal + $vatAmount, 2);
        $notes = $this->normalizeNotesText((string) ($validated['notes_text'] ?? ''));
        $validityDays = (int) ($validated['validity_days'] ?? 90);
        $senderCity = trim((string) ($validated['sender_city'] ?? '')) ?: 'Cần Thơ';

        if ($notes === []) {
            $notes = self::DEFAULT_NOTES;
        }

        if (!collect($notes)->contains(fn (string $line): bool => str_contains(mb_strtolower($line), 'hiệu lực'))) {
            $notes[] = 'Báo giá có hiệu lực trong vòng ' . $validityDays . ' ngày kể từ ngày ký.';
        }

        return [
            'recipient_name' => trim((string) $validated['recipient_name']),
            'sender_city' => $senderCity,
            'scope_summary' => trim((string) ($validated['scope_summary'] ?? '')) ?: self::DEFAULT_SCOPE_SUMMARY,
            'vat_rate' => $vatRate,
            'validity_days' => $validityDays,
            'notes' => $notes,
            'contact_line' => trim((string) ($validated['contact_line'] ?? '')) ?: self::DEFAULT_CONTACT_LINE,
            'closing_message' => trim((string) ($validated['closing_message'] ?? '')) ?: self::DEFAULT_CLOSING_MESSAGE,
            'signatory_title' => trim((string) ($validated['signatory_title'] ?? '')) ?: self::DEFAULT_SIGNATORY_TITLE,
            'signatory_unit' => trim((string) ($validated['signatory_unit'] ?? '')) ?: self::DEFAULT_SIGNATORY_UNIT,
            'signatory_name' => trim((string) ($validated['signatory_name'] ?? '')) ?: self::DEFAULT_SIGNATORY_NAME,
            'date' => $quoteDate,
            'date_display' => $this->buildStandardDateDisplay($senderCity, $quoteDate),
            'word_date_display' => $this->buildWordDateDisplay($senderCity, $quoteDate),
            'uses_multi_vat_template' => $usesMultiVatTemplate,
            'subtotal' => round($subtotal, 2),
            'vat_amount' => $vatAmount,
            'total' => $total,
            'total_in_words' => $this->capitalizeFirstLetter($this->toVietnameseMoneyText((int) round($total))),
            'items' => $items,
        ];
    }

    public function buildWordBinaryFromNormalizedQuotation(array $quotation): string
    {
        return $this->buildWordDocumentBinary($quotation);
    }

    public function buildExportFilename(string $recipientName, Carbon $date, string $extension): string
    {
        return $this->buildQuotationExportFilename($recipientName, $date, $extension);
    }

    public function buildContentDispositionHeader(string $filename, string $disposition = 'attachment'): string
    {
        return $this->buildContentDisposition($filename, $disposition);
    }

    /**
     * @param array<int, array{
     *   product_id: int|null,
     *   product_name: string,
     *   unit: string,
     *   quantity: float,
     *   unit_price: float,
     *   line_total: float,
     *   note: string
     * }> $items
     */
    private function ensureNoDuplicateQuotationItems(array $items): void
    {
        $seenKeys = [];

        foreach ($items as $item) {
            $key = $this->buildQuotationItemDuplicateKey($item['product_name'], $item['unit_price']);
            if ($key === '') {
                continue;
            }

            if (isset($seenKeys[$key])) {
                throw ValidationException::withMessages([
                    'items' => [self::DUPLICATE_QUOTATION_ITEM_MESSAGE],
                ]);
            }

            $seenKeys[$key] = true;
        }
    }

    private function buildQuotationItemDuplicateKey(string $productName, float $unitPrice): string
    {
        $normalizedName = mb_strtolower(trim($productName));
        if ($normalizedName === '') {
            return '';
        }

        return $normalizedName . '|' . number_format(round($unitPrice, 2), 2, '.', '');
    }

    private function buildWordDocumentBinary(array $quotation): string
    {
        $templateConfig = $this->resolveWordTemplateConfig((bool) $quotation['uses_multi_vat_template']);
        $documentXml = $quotation['uses_multi_vat_template']
            ? $this->buildMultiVatWordDocumentXml(
                $quotation,
                $templateConfig['image_relation_id'],
                $templateConfig['footer_relation_id']
            )
            : $this->buildWordDocumentXml(
                $quotation,
                $templateConfig['image_relation_id'],
                $templateConfig['footer_relation_id']
            );
        $templatePath = $templateConfig['path'];
        if ($templatePath === null) {
            return $this->buildStandaloneWordDocumentBinary(
                $documentXml,
                $templateConfig['image_relation_id'],
                $templateConfig['footer_relation_id']
            );
        }

        return $this->buildTemplatedWordDocumentBinary($templatePath, $documentXml);
    }

    /**
     * @return array{path: string|null, image_relation_id: string, footer_relation_id: string}
     */
    private function resolveWordTemplateConfig(bool $usesMultiVatTemplate): array
    {
        $candidates = $usesMultiVatTemplate
            ? self::MULTI_VAT_TEMPLATE_CANDIDATES
            : self::SINGLE_VAT_TEMPLATE_CANDIDATES;

        foreach ($candidates as $candidate) {
            $absolutePath = base_path($candidate['path']);
            if (is_file($absolutePath)) {
                return [
                    'path' => $absolutePath,
                    'image_relation_id' => $candidate['image_relation_id'],
                    'footer_relation_id' => $candidate['footer_relation_id'],
                ];
            }
        }

        $fallback = $candidates[0];

        return [
            'path' => null,
            'image_relation_id' => $fallback['image_relation_id'],
            'footer_relation_id' => $fallback['footer_relation_id'],
        ];
    }

    private function buildTemplatedWordDocumentBinary(string $templatePath, string $documentXml): string
    {

        $tempPath = tempnam(sys_get_temp_dir(), 'qlcv_quote_');
        if ($tempPath === false) {
            throw new RuntimeException('Không thể tạo file tạm cho báo giá Word.');
        }

        $docxPath = $tempPath . '.docx';
        @unlink($docxPath);
        rename($tempPath, $docxPath);
        copy($templatePath, $docxPath);

        $zip = new ZipArchive();
        if ($zip->open($docxPath) !== true) {
            @unlink($docxPath);
            throw new RuntimeException('Không thể mở file mẫu báo giá Word.');
        }

        $zip->addFromString('word/document.xml', $documentXml);
        $zip->close();

        $binary = file_get_contents($docxPath);
        @unlink($docxPath);

        if ($binary === false) {
            throw new RuntimeException('Không thể đọc file báo giá Word đã tạo.');
        }

        return $binary;
    }

    private function buildStandaloneWordDocumentBinary(
        string $documentXml,
        string $imageRelationId,
        string $footerRelationId
    ): string
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'qlcv_quote_standalone_');
        if ($tempPath === false) {
            throw new RuntimeException('Không thể tạo file tạm cho báo giá Word.');
        }

        $docxPath = $tempPath . '.docx';
        @unlink($docxPath);
        rename($tempPath, $docxPath);

        $zip = new ZipArchive();
        if ($zip->open($docxPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            @unlink($docxPath);
            throw new RuntimeException('Không thể tạo file báo giá Word.');
        }

        $zip->addFromString('[Content_Types].xml', $this->buildStandaloneWordContentTypesXml());
        $zip->addFromString('_rels/.rels', $this->buildStandalonePackageRelationshipsXml());
        $zip->addFromString('docProps/core.xml', $this->buildStandaloneWordCorePropertiesXml());
        $zip->addFromString('docProps/app.xml', $this->buildStandaloneWordAppPropertiesXml());
        $zip->addFromString('word/document.xml', $documentXml);
        $zip->addFromString(
            'word/_rels/document.xml.rels',
            $this->buildStandaloneWordDocumentRelationshipsXml($imageRelationId, $footerRelationId)
        );
        $zip->addFromString('word/footer1.xml', $this->buildStandaloneWordFooterXml());
        $zip->addFromString('word/media/logo.png', $this->buildStandaloneWordLogoBinary());
        $zip->close();

        $binary = file_get_contents($docxPath);
        @unlink($docxPath);

        if ($binary === false) {
            throw new RuntimeException('Không thể đọc file báo giá Word đã tạo.');
        }

        return $binary;
    }

    private function buildStandaloneWordContentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Default Extension="png" ContentType="image/png"/>'
            . '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            . '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
            . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            . '</Types>';
    }

    private function buildStandalonePackageRelationshipsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
            . '</Relationships>';
    }

    private function buildStandaloneWordCorePropertiesXml(): string
    {
        $timestamp = Carbon::now('UTC')->format('Y-m-d\TH:i:s\Z');

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
            . ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
            . ' xmlns:dcterms="http://purl.org/dc/terms/"'
            . ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"'
            . ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            . '<dc:title>Bao gia san pham</dc:title>'
            . '<dc:creator>Codex</dc:creator>'
            . '<cp:lastModifiedBy>Codex</cp:lastModifiedBy>'
            . '<dcterms:created xsi:type="dcterms:W3CDTF">' . $timestamp . '</dcterms:created>'
            . '<dcterms:modified xsi:type="dcterms:W3CDTF">' . $timestamp . '</dcterms:modified>'
            . '</cp:coreProperties>';
    }

    private function buildStandaloneWordAppPropertiesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"'
            . ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            . '<Application>Microsoft Office Word</Application>'
            . '</Properties>';
    }

    private function buildStandaloneWordDocumentRelationshipsXml(
        string $imageRelationId,
        string $footerRelationId
    ): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="' . $imageRelationId . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>'
            . '<Relationship Id="' . $footerRelationId . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
            . '</Relationships>';
    }

    private function buildStandaloneWordFooterXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>';
    }

    private function buildStandaloneWordLogoBinary(): string
    {
        $binary = base64_decode(self::FALLBACK_WORD_LOGO_PNG_BASE64, true);

        if (! is_string($binary) || $binary === '') {
            throw new RuntimeException('Không thể tạo logo mặc định cho báo giá Word.');
        }

        return $binary;
    }

    private function buildPdfDocumentBinary(array $quotation): string
    {
        $wordBinary = $this->buildWordDocumentBinary($quotation);
        $sofficeBinary = $this->findExecutable(
            ['soffice'],
            [
                '/opt/homebrew/bin/soffice',
                '/Applications/LibreOffice.app/Contents/MacOS/soffice',
            ]
        );

        if ($sofficeBinary !== null) {
            try {
                return $this->buildPdfDocumentBinaryFromLibreOffice($wordBinary, $sofficeBinary);
            } catch (Throwable) {
                // Fall through to the secondary converters below.
            }
        }

        try {
            return $this->buildPdfDocumentBinaryFromWord($wordBinary);
        } catch (Throwable $exception) {
            return $this->buildPdfDocumentBinaryFromHtml($quotation);
        }
    }

    private function buildPdfDocumentBinaryFromLibreOffice(string $wordBinary, string $sofficeBinary): string
    {
        $tempDirectory = $this->createTemporaryDirectory('qlcv_quote_libreoffice_');

        try {
            $docxPath = $tempDirectory . DIRECTORY_SEPARATOR . 'quotation.docx';
            $pdfPath = $tempDirectory . DIRECTORY_SEPARATOR . 'quotation.pdf';
            $profileDirectory = $tempDirectory . DIRECTORY_SEPARATOR . 'libreoffice-profile';

            if (file_put_contents($docxPath, $wordBinary) === false) {
                throw new RuntimeException('Không thể ghi file Word tạm để convert PDF bằng LibreOffice.');
            }

            if (!mkdir($profileDirectory, 0700, true) && !is_dir($profileDirectory)) {
                throw new RuntimeException('Không thể tạo profile tạm cho LibreOffice.');
            }

            $profileUri = 'file://' . str_replace(DIRECTORY_SEPARATOR, '/', $profileDirectory);

            $this->runExternalProcess(
                new Process([
                    $sofficeBinary,
                    '--headless',
                    '--nologo',
                    '--nodefault',
                    '--nofirststartwizard',
                    '--nolockcheck',
                    '-env:UserInstallation=' . $profileUri,
                    '--convert-to',
                    'pdf:writer_pdf_Export',
                    '--outdir',
                    $tempDirectory,
                    $docxPath,
                ], $tempDirectory, null, null, 120),
                'Không thể convert Word sang PDF bằng LibreOffice.'
            );

            $binary = file_get_contents($pdfPath);
            if ($binary === false || $binary === '') {
                throw new RuntimeException('LibreOffice không tạo ra file PDF hợp lệ.');
            }

            return $binary;
        } finally {
            $this->deleteDirectoryRecursively($tempDirectory);
        }
    }

    private function buildPdfDocumentBinaryFromWord(string $wordBinary): string
    {
        $quickLookBinary = $this->findExecutable(['qlmanage'], ['/usr/bin/qlmanage']);
        $chromeBinary = $this->findExecutable(
            ['google-chrome', 'chromium', 'chromium-browser', 'chrome'],
            [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            ]
        );

        if ($quickLookBinary === null || $chromeBinary === null) {
            throw new RuntimeException('Không tìm thấy công cụ convert Word sang PDF trong môi trường hiện tại.');
        }

        $tempDirectory = $this->createTemporaryDirectory('qlcv_quote_pdf_');

        try {
            $docxPath = $tempDirectory . DIRECTORY_SEPARATOR . 'quotation.docx';
            $pdfPath = $tempDirectory . DIRECTORY_SEPARATOR . 'quotation.pdf';
            $previewDirectory = $tempDirectory . DIRECTORY_SEPARATOR . 'quotation.docx.qlpreview';
            $previewHtmlPath = $previewDirectory . DIRECTORY_SEPARATOR . 'Preview.html';

            if (file_put_contents($docxPath, $wordBinary) === false) {
                throw new RuntimeException('Không thể ghi file Word tạm để convert PDF.');
            }

            $this->runExternalProcess(
                new Process([$quickLookBinary, '-o', $tempDirectory, '-p', $docxPath], $tempDirectory, null, null, 60),
                'Không thể tạo Quick Look preview từ file Word.'
            );

            if (!is_file($previewHtmlPath)) {
                throw new RuntimeException('Không tìm thấy file preview HTML sau khi convert Word.');
            }

            $this->printPreviewHtmlToPdf($chromeBinary, $previewHtmlPath, $pdfPath, $tempDirectory);

            $binary = file_get_contents($pdfPath);
            if ($binary === false || $binary === '') {
                throw new RuntimeException('Không thể đọc file PDF đã convert.');
            }

            return $binary;
        } finally {
            $this->deleteDirectoryRecursively($tempDirectory);
        }
    }

    private function buildPdfDocumentBinaryFromHtml(array $quotation): string
    {
        $options = new Options();
        $options->set('defaultFont', 'DejaVu Serif');
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($this->buildPdfHtml($quotation), 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    private function buildPdfHtml(array $quotation): string
    {
        $itemRows = '';
        foreach ($quotation['items'] as $index => $item) {
            $noteLines = $quotation['uses_multi_vat_template']
                ? $this->buildMultiVatNoteLines($item)
                : $this->splitMultilineText($item['note']);
            $noteHtml = $noteLines === []
                ? '&nbsp;'
                : implode('', array_map(
                    fn (string $line): string => '<div>' . $this->escapeHtml($line) . '</div>',
                    $noteLines
                ));

            if ($quotation['uses_multi_vat_template']) {
                $itemRows .= '<tr>'
                    . '<td class="center">' . ($index + 1) . '</td>'
                    . '<td>' . $this->escapeHtml($item['product_name']) . '</td>'
                    . '<td class="center">' . $this->escapeHtml($item['unit'] ?: '—') . '</td>'
                    . '<td class="center">' . $this->escapeHtml($this->formatQuantity($item['quantity'])) . '</td>'
                    . '<td class="right">' . $this->escapeHtml($this->formatMoney($item['unit_price'])) . '</td>'
                    . '<td class="right">' . $this->escapeHtml($this->formatMoney($item['vat_amount'])) . '</td>'
                    . '<td class="right">' . $this->escapeHtml($this->formatMoney($item['total_with_vat'])) . '</td>'
                    . '<td>' . $noteHtml . '</td>'
                    . '</tr>';
                continue;
            }

            $itemRows .= '<tr>'
                . '<td class="center">' . ($index + 1) . '</td>'
                . '<td>' . $this->escapeHtml($item['product_name']) . '</td>'
                . '<td class="center">' . $this->escapeHtml($item['unit'] ?: '—') . '</td>'
                . '<td class="center">' . $this->escapeHtml($this->formatQuantity($item['quantity'])) . '</td>'
                . '<td class="right">' . $this->escapeHtml($this->formatMoney($item['unit_price'])) . '</td>'
                . '<td class="right">' . $this->escapeHtml($this->formatMoney($item['line_total'])) . '</td>'
                . '<td>' . $noteHtml . '</td>'
                . '</tr>';
        }

        $noteParagraphs = '';
        foreach ($quotation['notes'] as $note) {
            $noteParagraphs .= '<p class="note-line">- ' . $this->escapeHtml($note) . '</p>';
        }

        $signatoryName = trim((string) $quotation['signatory_name']) !== ''
            ? '<p class="signature-name">' . $this->escapeHtml($quotation['signatory_name']) . '</p>'
            : '';

        $tableColGroup = $quotation['uses_multi_vat_template']
            ? '<col style="width: 6%;"><col style="width: 26%;"><col style="width: 12%;"><col style="width: 9%;"><col style="width: 14%;"><col style="width: 12%;"><col style="width: 13%;"><col style="width: 16%;">'
            : '<col style="width: 6%;"><col style="width: 28%;"><col style="width: 13%;"><col style="width: 10%;"><col style="width: 14%;"><col style="width: 14%;"><col style="width: 15%;">';
        $tableHeader = $quotation['uses_multi_vat_template']
            ? '<th>TT</th><th>Hạng mục công việc</th><th>Đơn vị tính</th><th>Số lượng</th><th>Đơn giá</th><th>Thuế GTGT</th><th>Thành tiền (Có VAT)</th><th>Ghi chú</th>'
            : '<th>TT</th><th>Hạng mục công việc</th><th>Đơn vị tính</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th>';
        $summaryRows = $quotation['uses_multi_vat_template']
            ? '<tr><td colspan="6" class="right summary-label">TỔNG TIỀN TRƯỚC THUẾ</td><td class="right summary-value">' . $this->escapeHtml($this->formatMoney($quotation['subtotal'])) . '</td><td>&nbsp;</td></tr>'
                . '<tr><td colspan="6" class="right summary-label">THUẾ GTGT</td><td class="right summary-value">' . $this->escapeHtml($this->formatMoney($quotation['vat_amount'])) . '</td><td>&nbsp;</td></tr>'
                . '<tr><td colspan="6" class="right summary-label">TỔNG CỘNG</td><td class="right summary-value">' . $this->escapeHtml($this->formatMoney($quotation['total'])) . '</td><td>&nbsp;</td></tr>'
            : '<tr><td colspan="5" class="right summary-label">TỔNG CỘNG TRƯỚC THUẾ</td><td colspan="2" class="right summary-value">' . $this->escapeHtml($this->formatMoney($quotation['subtotal'])) . '</td></tr>'
                . '<tr><td colspan="5" class="right summary-label">THUẾ GTGT (' . $this->escapeHtml($this->formatRate($quotation['vat_rate'])) . '%)</td><td colspan="2" class="right summary-value">' . $this->escapeHtml($this->formatMoney($quotation['vat_amount'])) . '</td></tr>'
                . '<tr><td colspan="5" class="right summary-label">TỔNG CỘNG SAU THUẾ</td><td colspan="2" class="right summary-value">' . $this->escapeHtml($this->formatMoney($quotation['total'])) . '</td></tr>';
        $appendixSections = $this->buildHtmlAppendixSections($quotation);

        return '<!doctype html>'
            . '<html lang="vi">'
            . '<head>'
            . '<meta charset="utf-8">'
            . '<style>'
            . '@page { size: A4 portrait; margin: 20mm 20mm 20mm 20mm; }'
            . 'body { margin: 0; color: #111; font-family: "Times New Roman", "DejaVu Serif", serif; font-size: 13pt; }'
            . '.page { width: 100%; }'
            . '.header-company { margin: 0; text-align: center; font-size: 13pt; font-weight: 700; line-height: 1.2; }'
            . '.header-company + .header-company { margin-top: 2pt; }'
            . '.header-sub { margin: 2pt 0 0; text-align: center; font-size: 12pt; font-style: italic; line-height: 1.2; }'
            . '.date { margin: 18pt 0 6pt; text-align: right; font-size: 13pt; font-style: italic; }'
            . '.title { margin: 4pt 0 6pt; text-align: center; font-size: 16pt; font-weight: 700; }'
            . '.recipient { margin: 0 0 8pt; text-align: center; font-size: 13pt; font-weight: 700; }'
            . '.body-text { margin: 0 0 6pt; text-align: justify; text-indent: 1.5em; font-size: 13pt; line-height: 1.35; }'
            . '.unit-label { margin: 0 0 6pt; text-align: right; font-size: 13pt; font-style: italic; }'
            . 'table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12pt; }'
            . 'thead { display: table-header-group; }'
            . 'tr { page-break-inside: avoid; }'
            . 'th, td { border: 1px solid #111; padding: 6pt 7pt; vertical-align: top; line-height: 1.35; word-wrap: break-word; }'
            . 'th { text-align: center; font-weight: 700; }'
            . '.center { text-align: center; vertical-align: middle; }'
            . '.right { text-align: right; vertical-align: middle; }'
            . '.summary-label, .summary-value { font-weight: 700; }'
            . '.value-in-words { margin: 10pt 0 6pt; font-size: 13pt; font-weight: 700; line-height: 1.35; }'
            . '.note-heading { margin: 0 0 6pt; font-size: 13pt; font-weight: 700; }'
            . '.note-line, .contact-line, .closing { margin: 0 0 6pt; font-size: 13pt; line-height: 1.35; }'
            . '.signature-wrap { width: 49%; margin-left: auto; margin-top: 14pt; text-align: center; }'
            . '.signature-title, .signature-unit, .signature-name { margin: 0; font-size: 14pt; font-weight: 700; line-height: 1.2; }'
            . '.signature-title { margin-bottom: 4pt; }'
            . '.signature-unit { margin-bottom: 50pt; font-size: 13pt; line-height: 1.15; }'
            . '.appendix { page-break-before: always; }'
            . '.appendix-title { margin: 0 0 6pt; text-align: center; font-size: 14pt; font-weight: 700; }'
            . '.appendix-product { margin: 0 0 4pt; text-align: center; font-size: 14pt; font-weight: 700; text-transform: uppercase; }'
            . '.appendix-caption { margin: 0; text-align: center; font-size: 12pt; font-style: italic; line-height: 1.3; }'
            . '.appendix-caption-tight { margin-bottom: 8pt; }'
            . '.appendix-table { margin-top: 0; }'
            . '.appendix-table th, .appendix-table td { padding: 3pt 4pt; font-size: 13pt; }'
            . '.appendix-table thead th { vertical-align: middle; font-weight: 700; }'
            . '.appendix-table .stt { width: 7.5%; text-align: center; vertical-align: middle; }'
            . '.appendix-table .name { width: 41.8%; text-align: left; vertical-align: middle; }'
            . '.appendix-table .description { width: 50.7%; text-align: left; vertical-align: top; line-height: 1.25; }'
            . '.appendix-table tr.group-row td { font-weight: 700; }'
            . '</style>'
            . '</head>'
            . '<body>'
            . '<div class="page">'
            . '<p class="header-company">VNPT CẦN THƠ</p>'
            . '<p class="header-company">TRUNG TÂM KINH DOANH GIẢI PHÁP</p>'
            . '<p class="header-sub">Địa chỉ: 11 Phan Đình Phùng, phường Ninh Kiều, TP. Cần Thơ</p>'
            . '<p class="header-sub">Điện thoại: 0292 3820888</p>'
            . '<p class="date">' . $this->escapeHtml($quotation['word_date_display']) . '</p>'
            . '<p class="title">BÁO GIÁ</p>'
            . '<p class="recipient">Kính gửi: ' . $this->escapeHtml($quotation['recipient_name']) . '</p>'
            . '<p class="body-text">Lời đầu tiên, Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ xin gửi đến Quý đơn vị lời chúc sức khỏe và thành công trong mọi lĩnh vực!</p>'
            . '<p class="body-text">Căn cứ theo nhu cầu của Quý đơn vị, Chúng tôi xin trân trọng gửi đến Quý đơn vị bảng báo giá chi phí các hạng mục công việc '
            . $this->escapeHtml($quotation['scope_summary'])
            . ', cụ thể như sau:</p>'
            . '<p class="unit-label">ĐVT: đồng</p>'
            . '<table>'
            . '<colgroup>'
            . $tableColGroup
            . '</colgroup>'
            . '<thead><tr>'
            . $tableHeader
            . '</tr></thead>'
            . '<tbody>'
            . $itemRows
            . $summaryRows
            . '</tbody>'
            . '</table>'
            . '<p class="value-in-words">Bằng chữ: ' . $this->escapeHtml($this->capitalizeFirstLetter($quotation['total_in_words'])) . '.</p>'
            . '<p class="note-heading">* Ghi chú:</p>'
            . $noteParagraphs
            . '<p class="contact-line">* Mọi thông tin trao đổi, vui lòng liên hệ: ' . $this->escapeHtml($quotation['contact_line']) . '</p>'
            . '<p class="closing">' . $this->escapeHtml($quotation['closing_message']) . '</p>'
            . '<div class="signature-wrap">'
            . '<p class="signature-title">' . $this->escapeHtml($quotation['signatory_title']) . '</p>'
            . '<p class="signature-unit">' . $this->escapeHtml($quotation['signatory_unit']) . '</p>'
            . $signatoryName
            . '</div>'
            . $appendixSections
            . '</div>'
            . '</body>'
            . '</html>';
    }

    private function buildWordDocumentXml(
        array $quotation,
        string $headerImageRelationId,
        string $footerRelationId
    ): string
    {
        $headerGridWidths = $this->scaleWordWidths(self::WORD_HEADER_TABLE_GRID_WIDTHS, self::WORD_TEXT_WIDTH);
        $quotationGridWidths = $this->scaleWordWidths(self::WORD_TABLE_GRID_WIDTHS, self::WORD_TEXT_WIDTH);
        $quotationTableWidth = array_sum($quotationGridWidths);
        $quotationSummaryLabelWidth = array_sum(array_slice($quotationGridWidths, 0, 5));
        $quotationSummaryAmountWidth = array_sum(array_slice($quotationGridWidths, 5));
        $signatureGridWidths = $this->scaleWordWidths(self::WORD_SIGNATURE_TABLE_GRID_WIDTHS, self::WORD_TEXT_WIDTH);

        $itemRows = '';
        foreach ($quotation['items'] as $index => $item) {
            $itemRows .= $this->buildWordQuotationItemRow($index + 1, $item, $quotationGridWidths);
        }

        $noteParagraphs = '';
        foreach ($quotation['notes'] as $note) {
            $noteParagraphs .= $this->buildWordBodyParagraph('- ' . $note, 0, 120);
        }

        $gridCols = '';
        foreach ($quotationGridWidths as $width) {
            $gridCols .= '<w:gridCol w:w="' . $width . '"/>';
        }

        $signatureBlock = $this->buildWordSignatureTable(
            $quotation['signatory_title'],
            $quotation['signatory_unit'],
            $quotation['signatory_name'],
            $signatureGridWidths
        );
        $appendixSections = $this->buildWordAppendixSections($quotation, $quotationTableWidth);

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
            . ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
            . ' xmlns:o="urn:schemas-microsoft-com:office:office"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            . ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
            . ' xmlns:v="urn:schemas-microsoft-com:vml"'
            . ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"'
            . ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
            . ' xmlns:w10="urn:schemas-microsoft-com:office:word"'
            . ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            . ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
            . ' xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"'
            . ' xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"'
            . ' xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"'
            . ' xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"'
            . ' xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du"'
            . ' xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash"'
            . ' xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock"'
            . ' xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"'
            . ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
            . ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
            . ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
            . ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
            . ' mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">'
            . '<w:body>'
            . $this->buildWordHeaderTable(
                $headerGridWidths,
                $headerImageRelationId,
                self::WORD_HEADER_LOGO_WIDTH,
                self::WORD_HEADER_LOGO_HEIGHT
            )
            . $this->buildWordDateParagraph($quotation['word_date_display'])
            . $this->buildWordTitleParagraph('BÁO GIÁ')
            . $this->buildWordCenteredParagraph('Kính gửi: ' . $quotation['recipient_name'], true)
            . $this->buildWordBodyParagraph('Lời đầu tiên, Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ xin gửi đến Quý đơn vị lời chúc sức khỏe và thành công trong mọi lĩnh vực!')
            . $this->buildWordBodyParagraph(
                'Căn cứ theo nhu cầu của Quý đơn vị, Chúng tôi xin trân trọng gửi đến Quý đơn vị bảng báo giá chi phí các hạng mục công việc '
                . $quotation['scope_summary']
                . ', cụ thể như sau:'
            )
            . $this->buildWordRightItalicParagraph('ĐVT: đồng')
            . '<w:tbl>'
            . '<w:tblPr>'
            . '<w:tblW w:w="' . $quotationTableWidth . '" w:type="dxa"/>'
            . '<w:jc w:val="center"/>'
            . '<w:tblBorders>'
            . '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '</w:tblBorders>'
            . '<w:tblLayout w:type="fixed"/>'
            . '</w:tblPr>'
            . '<w:tblGrid>' . $gridCols . '</w:tblGrid>'
            . $this->buildWordQuotationHeaderRow($quotationGridWidths)
            . $itemRows
            . $this->buildWordSummaryRow('TỔNG CỘNG TRƯỚC THUẾ', $quotation['subtotal'], $quotationSummaryLabelWidth, $quotationSummaryAmountWidth)
            . $this->buildWordSummaryRow('THUẾ GTGT (' . $this->formatRate($quotation['vat_rate']) . '%)', $quotation['vat_amount'], $quotationSummaryLabelWidth, $quotationSummaryAmountWidth)
            . $this->buildWordSummaryRow('TỔNG CỘNG SAU THUẾ', $quotation['total'], $quotationSummaryLabelWidth, $quotationSummaryAmountWidth, true)
            . '</w:tbl>'
            . $this->buildWordValueInWordsParagraph($quotation['total_in_words'])
            . $this->buildWordBodyParagraph('* Ghi chú:', 0, 120, true)
            . $noteParagraphs
            . $this->buildWordBodyParagraph('* Mọi thông tin trao đổi, vui lòng liên hệ: ' . $quotation['contact_line'], 0, 120)
            . $this->buildWordBodyParagraph($quotation['closing_message'], 0, 320)
            . $signatureBlock
            . $appendixSections
            . '<w:sectPr w:rsidR="00AF4D1B" w:rsidSect="004465C1">'
            . '<w:footerReference w:type="default" r:id="' . $footerRelationId . '"/>'
            . '<w:pgSz w:w="' . self::WORD_PAGE_WIDTH . '" w:h="' . self::WORD_PAGE_HEIGHT . '" w:orient="portrait"/>'
            . '<w:pgMar w:top="' . self::WORD_PAGE_MARGIN_TOP . '" w:right="' . self::WORD_PAGE_MARGIN_RIGHT . '" w:bottom="' . self::WORD_PAGE_MARGIN_BOTTOM . '" w:left="' . self::WORD_PAGE_MARGIN_LEFT . '" w:header="' . self::WORD_PAGE_HEADER . '" w:footer="' . self::WORD_PAGE_FOOTER . '" w:gutter="0"/>'
            . '<w:pgBorders w:offsetFrom="page">'
            . '<w:top w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '<w:left w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '<w:bottom w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '<w:right w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '</w:pgBorders>'
            . '<w:pgNumType w:start="1"/>'
            . '<w:cols w:space="720"/>'
            . '<w:docGrid w:linePitch="360"/>'
            . '</w:sectPr>'
            . '</w:body>'
            . '</w:document>';
    }

    private function buildMultiVatWordDocumentXml(
        array $quotation,
        string $headerImageRelationId,
        string $footerRelationId
    ): string
    {
        $headerGridWidths = self::MULTI_VAT_WORD_HEADER_TABLE_GRID_WIDTHS;
        $quotationGridWidths = self::MULTI_VAT_WORD_TABLE_GRID_WIDTHS;
        $quotationTableWidth = array_sum($quotationGridWidths);
        $quotationSummaryLabelWidth = array_sum(array_slice($quotationGridWidths, 0, 6));
        $quotationSummaryAmountWidth = $quotationGridWidths[6];
        $quotationSummaryTrailingWidth = $quotationGridWidths[7];
        $signatureGridWidths = self::MULTI_VAT_WORD_SIGNATURE_TABLE_GRID_WIDTHS;

        $itemRows = '';
        foreach ($quotation['items'] as $index => $item) {
            $itemRows .= $this->buildMultiVatWordQuotationItemRow($index + 1, $item, $quotationGridWidths);
        }

        $noteParagraphs = '';
        foreach ($quotation['notes'] as $note) {
            $noteParagraphs .= $this->buildWordBodyParagraph('- ' . $note, 0, 120);
        }

        $gridCols = '';
        foreach ($quotationGridWidths as $width) {
            $gridCols .= '<w:gridCol w:w="' . $width . '"/>';
        }

        $signatureBlock = $this->buildWordSignatureTable(
            $quotation['signatory_title'],
            $quotation['signatory_unit'],
            $quotation['signatory_name'],
            $signatureGridWidths
        );
        $appendixSections = $this->buildWordAppendixSections($quotation, $quotationTableWidth);

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
            . ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
            . ' xmlns:o="urn:schemas-microsoft-com:office:office"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            . ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
            . ' xmlns:v="urn:schemas-microsoft-com:vml"'
            . ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"'
            . ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
            . ' xmlns:w10="urn:schemas-microsoft-com:office:word"'
            . ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            . ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
            . ' xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"'
            . ' xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"'
            . ' xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"'
            . ' xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"'
            . ' xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du"'
            . ' xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash"'
            . ' xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock"'
            . ' xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"'
            . ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
            . ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
            . ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
            . ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
            . ' mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">'
            . '<w:body>'
            . $this->buildWordHeaderTable(
                $headerGridWidths,
                $headerImageRelationId,
                self::MULTI_VAT_WORD_HEADER_LOGO_WIDTH,
                self::MULTI_VAT_WORD_HEADER_LOGO_HEIGHT
            )
            . $this->buildWordDateParagraph($quotation['word_date_display'])
            . $this->buildWordTitleParagraph('BÁO GIÁ')
            . $this->buildWordCenteredParagraph('Kính gửi: ' . $quotation['recipient_name'], true)
            . $this->buildWordBodyParagraph('Lời đầu tiên, Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ xin gửi đến Quý đơn vị lời chúc sức khỏe và thành công trong mọi lĩnh vực!')
            . $this->buildWordBodyParagraph(
                'Căn cứ theo nhu cầu của Quý đơn vị, Chúng tôi xin trân trọng gửi đến Quý đơn vị bảng báo giá chi phí các hạng mục công việc '
                . $quotation['scope_summary']
                . ', cụ thể như sau:'
            )
            . $this->buildWordRightItalicParagraph('ĐVT: đồng')
            . '<w:tbl>'
            . '<w:tblPr>'
            . '<w:tblW w:w="' . $quotationTableWidth . '" w:type="dxa"/>'
            . '<w:jc w:val="center"/>'
            . '<w:tblBorders>'
            . '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            . '</w:tblBorders>'
            . '<w:tblLayout w:type="fixed"/>'
            . '</w:tblPr>'
            . '<w:tblGrid>' . $gridCols . '</w:tblGrid>'
            . $this->buildMultiVatWordQuotationHeaderRow($quotationGridWidths)
            . $itemRows
            . $this->buildMultiVatWordSummaryRow('TỔNG TIỀN TRƯỚC THUẾ', $quotation['subtotal'], $quotationSummaryLabelWidth, $quotationSummaryAmountWidth, $quotationSummaryTrailingWidth)
            . $this->buildMultiVatWordSummaryRow('THUẾ GTGT', $quotation['vat_amount'], $quotationSummaryLabelWidth, $quotationSummaryAmountWidth, $quotationSummaryTrailingWidth)
            . $this->buildMultiVatWordSummaryRow('TỔNG CỘNG', $quotation['total'], $quotationSummaryLabelWidth, $quotationSummaryAmountWidth, $quotationSummaryTrailingWidth, true)
            . '</w:tbl>'
            . $this->buildWordValueInWordsParagraph($quotation['total_in_words'])
            . $this->buildWordBodyParagraph('* Ghi chú:', 0, 120, true)
            . $noteParagraphs
            . $this->buildWordBodyParagraph('* Mọi thông tin trao đổi, vui lòng liên hệ: ' . $quotation['contact_line'], 0, 120)
            . $this->buildWordBodyParagraph($quotation['closing_message'], 0, 320)
            . $signatureBlock
            . $appendixSections
            . '<w:sectPr w:rsidR="00AF4D1B" w:rsidSect="004465C1">'
            . '<w:footerReference w:type="default" r:id="' . $footerRelationId . '"/>'
            . '<w:pgSz w:w="' . self::WORD_PAGE_WIDTH . '" w:h="' . self::WORD_PAGE_HEIGHT . '" w:orient="portrait"/>'
            . '<w:pgMar w:top="' . self::MULTI_VAT_WORD_PAGE_MARGIN_TOP . '" w:right="' . self::MULTI_VAT_WORD_PAGE_MARGIN_RIGHT . '" w:bottom="' . self::MULTI_VAT_WORD_PAGE_MARGIN_BOTTOM . '" w:left="' . self::MULTI_VAT_WORD_PAGE_MARGIN_LEFT . '" w:header="' . self::WORD_PAGE_HEADER . '" w:footer="' . self::WORD_PAGE_FOOTER . '" w:gutter="0"/>'
            . '<w:pgBorders w:offsetFrom="page">'
            . '<w:top w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '<w:left w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '<w:bottom w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '<w:right w:val="double" w:sz="4" w:space="24" w:color="auto"/>'
            . '</w:pgBorders>'
            . '<w:pgNumType w:start="1"/>'
            . '<w:cols w:space="720"/>'
            . '<w:docGrid w:linePitch="360"/>'
            . '</w:sectPr>'
            . '</w:body>'
            . '</w:document>';
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildMultiVatWordQuotationHeaderRow(array $gridWidths): string
    {
        $cells = [
            $this->buildWordTableCell(['TT'], $gridWidths[0], 'center', true),
            $this->buildWordTableCell(['Hạng mục', 'công việc'], $gridWidths[1], 'center', true),
            $this->buildWordTableCell(['Đơn vị tính'], $gridWidths[2], 'center', true),
            $this->buildWordTableCell(['Số lượng'], $gridWidths[3], 'center', true),
            $this->buildWordTableCell(['Đơn giá'], $gridWidths[4], 'center', true),
            $this->buildWordTableCell(['Thuế GTGT'], $gridWidths[5], 'center', true),
            $this->buildWordTableCell(['Thành tiền', '(Có VAT)'], $gridWidths[6], 'center', true),
            $this->buildWordTableCell(['Ghi chú'], $gridWidths[7], 'center', true),
        ];

        return '<w:tr><w:trPr><w:trHeight w:hRule="exact" w:val="730"/><w:tblHeader/></w:trPr>'
            . implode('', $cells)
            . '</w:tr>';
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildMultiVatWordQuotationItemRow(int $index, array $item, array $gridWidths): string
    {
        $noteLines = $this->buildMultiVatNoteLines($item);
        if ($noteLines === []) {
            $noteLines = [''];
        }

        $cells = [
            $this->buildWordTableCell([(string) $index], $gridWidths[0], 'center'),
            $this->buildWordTableCell([$item['product_name']], $gridWidths[1], 'left'),
            $this->buildWordTableCell([$item['unit'] ?: '—'], $gridWidths[2], 'center'),
            $this->buildWordTableCell([$this->formatQuantity($item['quantity'])], $gridWidths[3], 'center'),
            $this->buildWordTableCell([$this->formatMoney($item['unit_price'])], $gridWidths[4], 'right'),
            $this->buildWordTableCell([$this->formatMoney($item['vat_amount'])], $gridWidths[5], 'right'),
            $this->buildWordTableCell([$this->formatMoney($item['total_with_vat'])], $gridWidths[6], 'right'),
            $this->buildWordTableCell($noteLines, $gridWidths[7], 'left'),
        ];

        return '<w:tr>' . implode('', $cells) . '</w:tr>';
    }

    private function buildMultiVatWordSummaryRow(
        string $label,
        float $amount,
        int $labelWidth,
        int $amountWidth,
        int $trailingWidth,
        bool $emphasize = false
    ): string {
        return '<w:tr>'
            . $this->buildWordTableCell([$label], $labelWidth, 'right', true, 6, $emphasize)
            . $this->buildWordTableCell([$this->formatMoney($amount)], $amountWidth, 'right', true, 1, $emphasize)
            . $this->buildWordTableCell([''], $trailingWidth, 'left')
            . '</w:tr>';
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildWordHeaderTable(
        array $gridWidths,
        string $imageRelationId,
        int $logoWidth,
        int $logoHeight
    ): string
    {
        $tableWidth = array_sum($gridWidths);

        return '<w:tbl>'
            . '<w:tblPr><w:tblW w:w="' . $tableWidth . '" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/></w:tblPr>'
            . '<w:tblGrid><w:gridCol w:w="' . $gridWidths[0] . '"/><w:gridCol w:w="' . $gridWidths[1] . '"/></w:tblGrid>'
            . '<w:tr>'
            . '<w:trPr><w:trHeight w:val="1260"/></w:trPr>'
            . '<w:tc><w:tcPr><w:tcW w:w="' . $gridWidths[0] . '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>'
            . '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
            . '<w:r><w:rPr><w:noProof/></w:rPr>'
            . '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" wp14:anchorId="2FB5BA6C" wp14:editId="4F11306B">'
            . '<wp:extent cx="' . $logoWidth . '" cy="' . $logoHeight . '"/>'
            . '<wp:effectExtent l="19050" t="0" r="9525" b="0"/>'
            . '<wp:docPr id="1" name="Picture 1" descr="VNPT1"/>'
            . '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            . '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            . '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            . '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            . '<pic:nvPicPr><pic:cNvPr id="1" name="Picture 1" descr="VNPT1"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>'
            . '<pic:blipFill><a:blip r:embed="' . $imageRelationId . '" cstate="print"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            . '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' . $logoWidth . '" cy="' . $logoHeight . '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="9525"><a:noFill/><a:miter lim="800000"/><a:headEnd/><a:tailEnd/></a:ln></pic:spPr>'
            . '</pic:pic></a:graphicData></a:graphic>'
            . '</wp:inline></w:drawing></w:r></w:p></w:tc>'
            . '<w:tc><w:tcPr><w:tcW w:w="' . $gridWidths[1] . '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>'
            . $this->buildWordParagraph(
                'VNPT CẦN THƠ',
                '<w:pPr><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            )
            . $this->buildWordParagraph(
                'TRUNG TÂM KINH DOANH GIẢI PHÁP',
                '<w:pPr><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            )
            . $this->buildWordParagraph(
                'Địa chỉ: 11 Phan Đình Phùng, phường Ninh Kiều, TP. Cần Thơ',
                '<w:pPr><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:i/><w:spacing w:val="-8"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
            )
            . $this->buildWordParagraph(
                'Điện thoại: 0292 3820888',
                '<w:pPr><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:i/><w:spacing w:val="-8"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
            )
            . '</w:tc></w:tr></w:tbl>';
    }

    private function buildWordDateParagraph(string $dateDisplay): string
    {
        return $this->buildWordParagraph(
            $dateDisplay,
            '<w:pPr><w:spacing w:before="360" w:after="120"/><w:jc w:val="right"/></w:pPr>',
            '<w:rPr><w:i/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
        );
    }

    private function buildStandardDateDisplay(string $senderCity, Carbon $quoteDate): string
    {
        return sprintf(
            '%s, ngày %s tháng %s năm %s',
            $senderCity,
            $quoteDate->format('d'),
            $quoteDate->format('m'),
            $quoteDate->format('Y')
        );
    }

    private function buildWordDateDisplay(string $senderCity, Carbon $quoteDate): string
    {
        return sprintf(
            '%s, ngày ....... tháng %s năm %s',
            $senderCity,
            $quoteDate->format('m'),
            $quoteDate->format('Y')
        );
    }

    private function buildWordTitleParagraph(string $title): string
    {
        return $this->buildWordParagraph(
            $title,
            '<w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/></w:pPr>',
            '<w:rPr><w:b/><w:spacing w:val="-8"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>'
        );
    }

    private function buildWordCenteredParagraph(string $text, bool $bold = false): string
    {
        return $this->buildWordParagraph(
            $text,
            '<w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/></w:pPr>',
            '<w:rPr>' . ($bold ? '<w:b/>' : '') . '<w:spacing w:val="-8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
        );
    }

    private function buildWordBodyParagraph(
        string $text,
        int $before = 120,
        int $after = 120,
        bool $bold = false
    ): string {
        return $this->buildWordParagraph(
            $text,
            '<w:pPr><w:spacing w:before="' . $before . '" w:after="' . $after . '"/><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr>',
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
            . ($bold ? '<w:b/>' : '')
            . '<w:spacing w:val="-8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
        );
    }

    private function buildWordRightItalicParagraph(string $text): string
    {
        return $this->buildWordParagraph(
            $text,
            '<w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="right"/></w:pPr>',
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:spacing w:val="-8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
        );
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildWordQuotationHeaderRow(array $gridWidths): string
    {
        $cells = [
            $this->buildWordTableCell(['TT'], $gridWidths[0], 'center', true),
            $this->buildWordTableCell(['Hạng mục', 'công việc'], $gridWidths[1], 'center', true),
            $this->buildWordTableCell(['Đơn vị tính'], $gridWidths[2], 'center', true),
            $this->buildWordTableCell(['Số lượng'], $gridWidths[3], 'center', true),
            $this->buildWordTableCell(['Đơn giá'], $gridWidths[4], 'center', true),
            $this->buildWordTableCell(['Thành tiền'], $gridWidths[5], 'center', true),
            $this->buildWordTableCell(['Ghi chú'], $gridWidths[6], 'center', true),
        ];

        return '<w:tr><w:trPr><w:trHeight w:hRule="exact" w:val="730"/><w:tblHeader/></w:trPr>'
            . implode('', $cells)
            . '</w:tr>';
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildWordQuotationItemRow(int $index, array $item, array $gridWidths): string
    {
        $noteLines = $this->splitMultilineText($item['note']);
        if ($noteLines === []) {
            $noteLines = [''];
        }

        $cells = [
            $this->buildWordTableCell([(string) $index], $gridWidths[0], 'center'),
            $this->buildWordTableCell([$item['product_name']], $gridWidths[1], 'left'),
            $this->buildWordTableCell([$item['unit'] ?: '—'], $gridWidths[2], 'center'),
            $this->buildWordTableCell([$this->formatQuantity($item['quantity'])], $gridWidths[3], 'center'),
            $this->buildWordTableCell([$this->formatMoney($item['unit_price'])], $gridWidths[4], 'right'),
            $this->buildWordTableCell([$this->formatMoney($item['line_total'])], $gridWidths[5], 'right'),
            $this->buildWordTableCell($noteLines, $gridWidths[6], 'left'),
        ];

        return '<w:tr>' . implode('', $cells) . '</w:tr>';
    }

    private function buildWordSummaryRow(
        string $label,
        float $amount,
        int $labelWidth,
        int $amountWidth,
        bool $emphasize = false
    ): string
    {
        return '<w:tr>'
            . $this->buildWordTableCell([$label], $labelWidth, 'right', true, 5, $emphasize)
            . $this->buildWordTableCell([$this->formatMoney($amount)], $amountWidth, 'right', true, 2, $emphasize)
            . '</w:tr>';
    }

    private function buildWordValueInWordsParagraph(string $text): string
    {
        return $this->buildWordParagraph(
            'Bằng chữ: ' . $this->capitalizeFirstLetter($text) . '.',
            '<w:pPr><w:spacing w:before="220" w:after="220"/><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr>',
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:spacing w:val="-8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
        );
    }

    /**
     * @return array<int, array{
     *   index: int,
     *   product_name: string,
     *   rows: array<int, array{type: string, stt: string, name: string, description: string}>
     * }>
     */
    private function buildQuotationFeatureAppendices(array $quotation): array
    {
        $hasProductCatalogTables = Schema::hasTable('products')
            && Schema::hasTable('product_feature_groups')
            && Schema::hasTable('product_features');
        $hasPackageCatalogTables = Schema::hasTable('product_packages')
            && Schema::hasTable('product_package_feature_groups')
            && Schema::hasTable('product_package_features');

        if (! $hasProductCatalogTables && ! $hasPackageCatalogTables) {
            return [];
        }

        $catalogCache = [];
        $appendices = [];

        foreach ($quotation['items'] as $item) {
            $productId = isset($item['product_id']) ? (int) $item['product_id'] : null;
            $fallbackProductName = trim((string) ($item['product_name'] ?? ''));
            $catalog = $productId !== null && $productId > 0
                ? ($catalogCache[$productId] ??= $this->loadAppendixCatalogForQuotationItem($productId))
                : null;

            $rows = $catalog['rows'] ?? [];
            if ($rows === []) {
                $rows = [[
                    'type' => 'feature',
                    'stt' => '1',
                    'name' => 'Chưa cấu hình danh sách tính năng',
                    'description' => 'Sản phẩm này chưa có dữ liệu trong tab Danh sách chức năng.',
                ]];
            }

            $appendices[] = [
                'index' => count($appendices) + 1,
                'product_name' => $fallbackProductName !== ''
                    ? $fallbackProductName
                    : trim((string) ($catalog['product_name'] ?? '')),
                'rows' => $rows,
            ];
        }

        return $appendices;
    }

    /**
     * @return array{product_name: string, rows: array<int, array{type: string, stt: string, name: string, description: string}>}|null
     */
    private function loadAppendixCatalogForQuotationItem(int $productId): ?array
    {
        $packageCatalog = $this->loadAppendixCatalogForMatchingPackage($productId);
        if (($packageCatalog['rows'] ?? []) !== []) {
            return $packageCatalog;
        }

        return $this->loadAppendixCatalogForProduct($productId);
    }

    private function buildWordAppendixSections(array $quotation, int $tableWidth): string
    {
        $appendices = $this->buildQuotationFeatureAppendices($quotation);
        if ($appendices === []) {
            return '';
        }

        $gridWidths = $this->scaleWordWidths(self::WORD_APPENDIX_TABLE_GRID_WIDTHS, $tableWidth);
        $gridCols = '';
        foreach ($gridWidths as $width) {
            $gridCols .= '<w:gridCol w:w="' . $width . '"/>';
        }

        $sections = '';
        foreach ($appendices as $appendix) {
            [$captionLineOne, $captionLineTwo] = $this->buildAppendixCaptionLines($quotation);
            $rowsXml = '';
            foreach ($appendix['rows'] as $row) {
                $rowsXml .= $row['type'] === 'group'
                    ? $this->buildWordAppendixGroupRow($row, $gridWidths)
                    : $this->buildWordAppendixFeatureRow($row, $gridWidths);
            }

            $sections .= $this->buildWordPageBreak()
                . $this->buildWordAppendixTitleParagraph('PHỤ LỤC ' . $appendix['index'])
                . $this->buildWordAppendixTitleParagraph(
                    mb_strtoupper((string) $appendix['product_name'], 'UTF-8'),
                    0,
                    12,
                    28
                )
                . $this->buildWordAppendixCaptionParagraph($captionLineOne, 0)
                . $this->buildWordAppendixCaptionParagraph($captionLineTwo, 160)
                . '<w:tbl>'
                . '<w:tblPr>'
                . '<w:tblW w:w="' . $tableWidth . '" w:type="dxa"/>'
                . '<w:tblInd w:w="0" w:type="dxa"/>'
                . '<w:jc w:val="center"/>'
                . '<w:tblBorders>'
                . '<w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                . '<w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                . '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                . '<w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                . '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                . '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                . '</w:tblBorders>'
                . '<w:tblLayout w:type="fixed"/>'
                . '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
                . '</w:tblPr>'
                . '<w:tblGrid>' . $gridCols . '</w:tblGrid>'
                . $this->buildWordAppendixHeaderRow($gridWidths)
                . $rowsXml
                . '</w:tbl>';
        }

        return $sections;
    }

    /**
     * @param array{type: string, stt: string, name: string, description: string} $row
     * @param array<int, int> $gridWidths
     */
    private function buildWordAppendixGroupRow(array $row, array $gridWidths): string
    {
        return '<w:tr><w:trPr><w:trHeight w:val="315" w:hRule="atLeast"/></w:trPr>'
            . $this->buildWordAppendixTableCell([$row['stt']], $gridWidths[0], 'center', true, 'center', 'CCCCCC', '000000')
            . $this->buildWordAppendixTableCell([$row['name']], $gridWidths[1], 'left', true, 'center', 'CCCCCC', 'CCCCCC')
            . $this->buildWordAppendixTableCell([''], $gridWidths[2], 'left', false, 'center', 'CCCCCC', 'CCCCCC')
            . '</w:tr>';
    }

    /**
     * @param array{type: string, stt: string, name: string, description: string} $row
     * @param array<int, int> $gridWidths
     */
    private function buildWordAppendixFeatureRow(array $row, array $gridWidths): string
    {
        return '<w:tr><w:trPr><w:trHeight w:val="315" w:hRule="atLeast"/></w:trPr>'
            . $this->buildWordAppendixTableCell([$row['stt']], $gridWidths[0], 'center', false, 'center', 'CCCCCC', '000000')
            . $this->buildWordAppendixTableCell([$row['name']], $gridWidths[1], 'left', false, 'center', 'CCCCCC', 'CCCCCC')
            . $this->buildWordAppendixTableCell([$row['description']], $gridWidths[2], 'left', false, 'top', 'CCCCCC', 'CCCCCC')
            . '</w:tr>';
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildWordAppendixHeaderRow(array $gridWidths): string
    {
        return '<w:tr><w:trPr><w:trHeight w:val="575" w:hRule="atLeast"/><w:tblHeader/></w:trPr>'
            . $this->buildWordAppendixTableCell(['STT'], $gridWidths[0], 'center', true, 'center', '000000', '000000')
            . $this->buildWordAppendixTableCell(['Danh mục chức năng'], $gridWidths[1], 'center', true, 'center', '000000', 'CCCCCC')
            . $this->buildWordAppendixTableCell(['Mô tả chi tiết'], $gridWidths[2], 'center', true, 'center', '000000', 'CCCCCC')
            . '</w:tr>';
    }

    private function buildWordPageBreak(): string
    {
        return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }

    private function buildWordAppendixTitleParagraph(
        string $text,
        int $before = 0,
        int $after = 80,
        int $fontSize = 28
    ): string {
        return $this->buildWordParagraph(
            $text,
            '<w:pPr><w:spacing w:before="' . $before . '" w:after="' . $after . '" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>',
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:spacing w:val="-8"/><w:sz w:val="' . $fontSize . '"/><w:szCs w:val="' . $fontSize . '"/></w:rPr>'
        );
    }

    private function buildWordAppendixCaptionParagraph(string $text, int $after = 160): string
    {
        return $this->buildWordParagraph(
            $text,
            '<w:pPr><w:spacing w:before="0" w:after="' . $after . '" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>',
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:spacing w:val="-8"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
        );
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function buildAppendixCaptionLines(array $quotation): array
    {
        return [
            sprintf(
                '(Đính kèm báo giá ngày %s của Trung tâm Kinh doanh Giải pháp – VNPT Cần Thơ',
                $quotation['date']->format('d/m/Y')
            ),
            sprintf(
                'phát hành đến %s)',
                trim((string) ($quotation['recipient_name'] ?? ''))
            ),
        ];
    }

    /**
     * @param array<int, string> $paragraphs
     */
    private function buildWordAppendixTableCell(
        array $paragraphs,
        int $width,
        string $align = 'left',
        bool $bold = false,
        string $verticalAlign = 'center',
        string $topBorderColor = 'CCCCCC',
        string $leftBorderColor = 'CCCCCC'
    ): string {
        $paragraphXml = '';
        foreach ($paragraphs as $paragraph) {
            $paragraphXml .= $this->buildWordParagraph(
                $paragraph,
                '<w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="' . $align . '"/></w:pPr>',
                '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
                . ($bold ? '<w:b/>' : '')
                . '<w:spacing w:val="-8"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            );
        }

        if ($paragraphXml === '') {
            $paragraphXml = '<w:p/>';
        }

        return '<w:tc><w:tcPr>'
            . '<w:tcW w:w="' . $width . '" w:type="dxa"/>'
            . '<w:tcBorders>'
            . '<w:top w:val="single" w:color="' . $topBorderColor . '" w:sz="6" w:space="0"/>'
            . '<w:left w:val="single" w:color="' . $leftBorderColor . '" w:sz="6" w:space="0"/>'
            . '<w:bottom w:val="single" w:color="000000" w:sz="6" w:space="0"/>'
            . '<w:right w:val="single" w:color="000000" w:sz="6" w:space="0"/>'
            . '</w:tcBorders>'
            . '<w:tcMar><w:top w:w="30" w:type="dxa"/><w:left w:w="45" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="45" w:type="dxa"/></w:tcMar>'
            . '<w:vAlign w:val="' . $verticalAlign . '"/>'
            . '</w:tcPr>'
            . $paragraphXml
            . '</w:tc>';
    }

    /**
     * @return array{product_name: string, rows: array<int, array{type: string, stt: string, name: string, description: string}>}|null
     */
    private function loadAppendixCatalogForProduct(int $productId): ?array
    {
        if (! Schema::hasTable('products') || ! Schema::hasTable('product_feature_groups') || ! Schema::hasTable('product_features')) {
            return null;
        }

        $scope = $this->resolveAppendixCatalogScope($productId);
        if (($scope['product_ids'] ?? []) === []) {
            return null;
        }

        $groups = $this->loadAppendixCatalogGroups($scope['product_ids']);
        $rows = [];

        foreach ($groups as $groupIndex => $group) {
            $rows[] = [
                'type' => 'group',
                'stt' => $this->toRomanNumeral($groupIndex + 1),
                'name' => trim((string) ($group['group_name'] ?? '')),
                'description' => '',
            ];

            $featureIndex = 1;
            foreach ($group['features'] ?? [] as $feature) {
                $rows[] = [
                    'type' => 'feature',
                    'stt' => (string) $featureIndex++,
                    'name' => trim((string) ($feature['feature_name'] ?? '')),
                    'description' => trim((string) ($feature['detail_description'] ?? '')) ?: '—',
                ];
            }
        }

        return [
            'product_name' => trim((string) ($scope['product_name'] ?? '')),
            'rows' => $rows,
        ];
    }

    /**
     * @return array{product_name: string, rows: array<int, array{type: string, stt: string, name: string, description: string}>}|null
     */
    private function loadAppendixCatalogForMatchingPackage(int $productId): ?array
    {
        if (
            ! Schema::hasTable('product_packages')
            || ! Schema::hasTable('product_package_feature_groups')
            || ! Schema::hasTable('product_package_features')
        ) {
            return null;
        }

        $packageColumns = ['id'];
        foreach (['product_id', 'package_code', 'package_name'] as $column) {
            if (Schema::hasColumn('product_packages', $column)) {
                $packageColumns[] = $column;
            }
        }

        $package = DB::table('product_packages')
            ->select($packageColumns)
            ->where('product_id', $productId)
            ->when(
                Schema::hasColumn('product_packages', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('id')
            ->first();

        if (! $package) {
            return null;
        }

        $packageRow = (array) $package;
        $packageId = isset($packageRow['id']) ? (int) $packageRow['id'] : 0;
        if ($packageId <= 0) {
            return null;
        }

        $groups = $this->loadAppendixPackageCatalogGroups([$packageId]);
        if ($groups === []) {
            return null;
        }

        $rows = [];
        foreach ($groups as $groupIndex => $group) {
            $rows[] = [
                'type' => 'group',
                'stt' => $this->toRomanNumeral($groupIndex + 1),
                'name' => trim((string) ($group['group_name'] ?? '')),
                'description' => '',
            ];

            $featureIndex = 1;
            foreach ($group['features'] ?? [] as $feature) {
                $rows[] = [
                    'type' => 'feature',
                    'stt' => (string) $featureIndex++,
                    'name' => trim((string) ($feature['feature_name'] ?? '')),
                    'description' => trim((string) ($feature['detail_description'] ?? '')) ?: '—',
                ];
            }
        }

        return [
            'product_name' => trim((string) ($packageRow['package_name'] ?? $packageRow['package_code'] ?? '')),
            'rows' => $rows,
        ];
    }

    /**
     * @return array{product_name: string, product_ids: array<int, int>}
     */
    private function resolveAppendixCatalogScope(int $productId): array
    {
        if (! Schema::hasTable('products')) {
            return [
                'product_name' => '',
                'product_ids' => [$productId],
            ];
        }

        $selectColumns = ['id', 'product_name'];
        foreach (['service_group', 'domain_id', 'vendor_id', 'deleted_at'] as $column) {
            if (Schema::hasColumn('products', $column)) {
                $selectColumns[] = $column;
            }
        }

        $currentProduct = DB::table('products')
            ->select($selectColumns)
            ->where('id', $productId)
            ->first();

        if (! $currentProduct) {
            return [
                'product_name' => '',
                'product_ids' => [$productId],
            ];
        }

        $current = (array) $currentProduct;
        $productName = trim((string) ($current['product_name'] ?? ''));
        if ($productName === '') {
            return [
                'product_name' => '',
                'product_ids' => [$productId],
            ];
        }

        $query = DB::table('products')
            ->select($selectColumns)
            ->where('product_name', $productName);

        if (Schema::hasColumn('products', 'service_group') && trim((string) ($current['service_group'] ?? '')) !== '') {
            $query->where('service_group', trim((string) $current['service_group']));
        }

        if (Schema::hasColumn('products', 'domain_id') && $current['domain_id'] !== null) {
            $query->where('domain_id', (int) $current['domain_id']);
        }

        if (Schema::hasColumn('products', 'vendor_id') && $current['vendor_id'] !== null) {
            $query->where('vendor_id', (int) $current['vendor_id']);
        }

        $records = $query
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        if ($records->isEmpty()) {
            return [
                'product_name' => $productName,
                'product_ids' => [$productId],
            ];
        }

        return [
            'product_name' => $productName,
            'product_ids' => $records
                ->pluck('id')
                ->map(fn (mixed $id): int => (int) $id)
                ->filter(fn (int $id): bool => $id > 0)
                ->unique()
                ->values()
                ->all(),
        ];
    }

    /**
     * @param array<int, int> $productIds
     * @return array<int, array{group_name: string, features: array<int, array{feature_name: string, detail_description: string|null}>}>
     */
    private function loadAppendixCatalogGroups(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $groupColumns = ['id', 'product_id', 'group_name', 'display_order'];
        if (Schema::hasColumn('product_feature_groups', 'deleted_at')) {
            $groupColumns[] = 'deleted_at';
        }

        $featureColumns = ['id', 'product_id', 'group_id', 'feature_name', 'detail_description', 'display_order'];
        if (Schema::hasColumn('product_features', 'deleted_at')) {
            $featureColumns[] = 'deleted_at';
        }

        $groups = DB::table('product_feature_groups')
            ->select($groupColumns)
            ->whereIn('product_id', $productIds)
            ->when(
                Schema::hasColumn('product_feature_groups', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        $features = DB::table('product_features')
            ->select($featureColumns)
            ->whereIn('product_id', $productIds)
            ->when(
                Schema::hasColumn('product_features', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('group_id')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->groupBy(fn (array $record): string => (string) ($record['group_id'] ?? ''))
            ->all();

        return $groups
            ->map(function (array $group) use ($features): array {
                $groupId = (string) ($group['id'] ?? '');
                $items = collect($features[$groupId] ?? [])
                    ->map(fn (array $feature): array => [
                        'feature_name' => trim((string) ($feature['feature_name'] ?? '')),
                        'detail_description' => isset($feature['detail_description'])
                            ? trim((string) $feature['detail_description'])
                            : null,
                    ])
                    ->values()
                    ->all();

                return [
                    'group_name' => trim((string) ($group['group_name'] ?? '')),
                    'features' => $items,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param array<int, int> $packageIds
     * @return array<int, array{group_name: string, features: array<int, array{feature_name: string, detail_description: string|null}>}>
     */
    private function loadAppendixPackageCatalogGroups(array $packageIds): array
    {
        if ($packageIds === []) {
            return [];
        }

        $groupColumns = ['id', 'package_id', 'group_name', 'display_order'];
        if (Schema::hasColumn('product_package_feature_groups', 'deleted_at')) {
            $groupColumns[] = 'deleted_at';
        }

        $featureColumns = ['id', 'package_id', 'group_id', 'feature_name', 'detail_description', 'display_order'];
        if (Schema::hasColumn('product_package_features', 'deleted_at')) {
            $featureColumns[] = 'deleted_at';
        }

        $groups = DB::table('product_package_feature_groups')
            ->select($groupColumns)
            ->whereIn('package_id', $packageIds)
            ->when(
                Schema::hasColumn('product_package_feature_groups', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        $features = DB::table('product_package_features')
            ->select($featureColumns)
            ->whereIn('package_id', $packageIds)
            ->when(
                Schema::hasColumn('product_package_features', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('group_id')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->groupBy(fn (array $record): string => (string) ($record['group_id'] ?? ''))
            ->all();

        return $groups
            ->map(function (array $group) use ($features): array {
                $groupId = (string) ($group['id'] ?? '');
                $items = collect($features[$groupId] ?? [])
                    ->map(fn (array $feature): array => [
                        'feature_name' => trim((string) ($feature['feature_name'] ?? '')),
                        'detail_description' => isset($feature['detail_description'])
                            ? trim((string) $feature['detail_description'])
                            : null,
                    ])
                    ->values()
                    ->all();

                return [
                    'group_name' => trim((string) ($group['group_name'] ?? '')),
                    'features' => $items,
                ];
            })
            ->values()
            ->all();
    }

    private function buildHtmlAppendixSections(array $quotation): string
    {
        $appendices = $this->buildQuotationFeatureAppendices($quotation);
        if ($appendices === []) {
            return '';
        }

        $sections = '';
        foreach ($appendices as $appendix) {
            [$captionLineOne, $captionLineTwo] = $this->buildAppendixCaptionLines($quotation);
            $rowsHtml = '';
            foreach ($appendix['rows'] as $row) {
                $isGroup = $row['type'] === 'group';
                $rowsHtml .= '<tr' . ($isGroup ? ' class="group-row"' : '') . '>'
                    . '<td class="stt">' . $this->escapeHtml($row['stt']) . '</td>'
                    . '<td class="name">' . $this->escapeHtml($row['name']) . '</td>'
                    . '<td class="description">' . nl2br($this->escapeHtml($row['description'])) . '</td>'
                    . '</tr>';
            }

            $sections .= '<div class="appendix">'
                . '<p class="appendix-title">PHỤ LỤC ' . $appendix['index'] . '</p>'
                . '<p class="appendix-product">' . $this->escapeHtml(mb_strtoupper((string) $appendix['product_name'], 'UTF-8')) . '</p>'
                . '<p class="appendix-caption">' . $this->escapeHtml($captionLineOne) . '</p>'
                . '<p class="appendix-caption appendix-caption-tight">' . $this->escapeHtml($captionLineTwo) . '</p>'
                . '<table class="appendix-table">'
                . '<thead><tr><th>STT</th><th>Danh mục chức năng</th><th>Mô tả chi tiết</th></tr></thead>'
                . '<tbody>' . $rowsHtml . '</tbody>'
                . '</table>'
                . '</div>';
        }

        return $sections;
    }

    /**
     * @param array<int, int> $gridWidths
     */
    private function buildWordSignatureTable(string $title, string $unit, string $name, array $gridWidths): string
    {
        $tableWidth = array_sum($gridWidths);
        $nameParagraph = trim($name) !== ''
            ? $this->buildWordParagraph(
                $name,
                '<w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>'
            )
            : '';

        return '<w:tbl>'
            . '<w:tblPr><w:tblW w:w="' . $tableWidth . '" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/></w:tblPr>'
            . '<w:tblGrid><w:gridCol w:w="' . $gridWidths[0] . '"/><w:gridCol w:w="' . $gridWidths[1] . '"/></w:tblGrid>'
            . '<w:tr>'
            . '<w:tc><w:tcPr><w:tcW w:w="' . $gridWidths[0] . '" w:type="dxa"/></w:tcPr><w:p/></w:tc>'
            . '<w:tc><w:tcPr><w:tcW w:w="' . $gridWidths[1] . '" w:type="dxa"/></w:tcPr>'
            . $this->buildWordParagraph(
                $title,
                '<w:pPr><w:spacing w:before="320" w:after="80"/><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>'
            )
            . $this->buildWordParagraph(
                $unit,
                '<w:pPr><w:spacing w:after="80"/><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            )
            . $this->buildWordParagraph(
                ' ',
                '<w:pPr><w:spacing w:after="960"/><w:jc w:val="center"/></w:pPr>',
                '<w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>'
            )
            . $nameParagraph
            . '</w:tc>'
            . '</w:tr>'
            . '</w:tbl>';
    }

    /**
     * @param array<int, int> $baseWidths
     * @return array<int, int>
     */
    private function scaleWordWidths(array $baseWidths, int $targetWidth): array
    {
        if ($baseWidths === []) {
            return [];
        }

        $baseTotal = array_sum($baseWidths);
        if ($baseTotal <= 0 || $targetWidth <= 0) {
            return $baseWidths;
        }

        $scaledWidths = [];
        $cumulativeBase = 0;
        $cumulativeScaled = 0;
        $lastIndex = count($baseWidths) - 1;

        foreach ($baseWidths as $index => $width) {
            if ($index === $lastIndex) {
                $scaledWidths[] = max(1, $targetWidth - $cumulativeScaled);
                continue;
            }

            $cumulativeBase += $width;
            $nextTotal = (int) round($targetWidth * $cumulativeBase / $baseTotal);
            $scaledWidth = max(1, $nextTotal - $cumulativeScaled);
            $scaledWidths[] = $scaledWidth;
            $cumulativeScaled += $scaledWidth;
        }

        return $scaledWidths;
    }

    /**
     * @param array<int, string> $paragraphs
     */
    private function buildWordTableCell(
        array $paragraphs,
        int $width,
        string $align = 'left',
        bool $bold = false,
        int $gridSpan = 1,
        bool $emphasize = false
    ): string {
        $paragraphXml = '';
        foreach ($paragraphs as $paragraph) {
            $paragraphXml .= $this->buildWordParagraph(
                $paragraph,
                '<w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="' . $align . '"/></w:pPr>',
                '<w:rPr>'
                . ($bold ? '<w:b/>' : '')
                . ($emphasize ? '<w:color w:val="000000"/>' : '')
                . '<w:spacing w:val="-8"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
            );
        }

        if ($paragraphXml === '') {
            $paragraphXml = '<w:p/>';
        }

        return '<w:tc><w:tcPr><w:tcW w:w="' . $width . '" w:type="dxa"/>'
            . ($gridSpan > 1 ? '<w:gridSpan w:val="' . $gridSpan . '"/>' : '')
            . '<w:vAlign w:val="center"/></w:tcPr>'
            . $paragraphXml
            . '</w:tc>';
    }

    private function buildWordParagraph(string $text, string $paragraphPrXml, string $runPrXml): string
    {
        $segments = preg_split("/\r\n|\r|\n/u", $text) ?: [''];
        $runs = '';
        foreach ($segments as $index => $segment) {
            if ($index > 0) {
                $runs .= '<w:r>' . $runPrXml . '<w:br/></w:r>';
            }
            $runs .= '<w:r>' . $runPrXml . $this->buildWordTextNode($segment) . '</w:r>';
        }

        return '<w:p>' . $paragraphPrXml . $runs . '</w:p>';
    }

    private function buildWordTextNode(string $text): string
    {
        $escaped = $this->escapeXml($text);
        if ($escaped === '') {
            return '<w:t xml:space="preserve"> </w:t>';
        }

        return '<w:t xml:space="preserve">' . $escaped . '</w:t>';
    }

    private function buildExcelWorkbookXml(array $quotation): string
    {
        if ($quotation['uses_multi_vat_template']) {
            return $this->buildMultiVatExcelWorkbookXml($quotation);
        }

        $rows = [];
        $rows[] = $this->buildExcelRow([['value' => 'VNPT CẦN THƠ', 'style' => 'HeaderCenter', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'TRUNG TÂM KINH DOANH GIẢI PHÁP', 'style' => 'HeaderCenterBold', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'Địa chỉ: 11 Phan Đình Phùng, phường Ninh Kiều, TP. Cần Thơ', 'style' => 'HeaderCenterItalic', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'Điện thoại: 0292 3820888', 'style' => 'HeaderCenterItalic', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([]);
        $rows[] = $this->buildExcelRow([
            ['value' => $quotation['date_display'], 'style' => 'RightItalic', 'mergeAcross' => 6],
        ]);
        $rows[] = $this->buildExcelRow([]);
        $rows[] = $this->buildExcelRow([['value' => 'BÁO GIÁ', 'style' => 'Title', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'Kính gửi: ' . $quotation['recipient_name'], 'style' => 'CenterBold', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'Lời đầu tiên, Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ xin gửi đến Quý đơn vị lời chúc sức khỏe và thành công trong mọi lĩnh vực!', 'style' => 'Body', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'Căn cứ theo nhu cầu của Quý đơn vị, Chúng tôi xin trân trọng gửi đến Quý đơn vị bảng báo giá chi phí các hạng mục công việc ' . $quotation['scope_summary'] . ', cụ thể như sau:', 'style' => 'Body', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => 'ĐVT: đồng', 'style' => 'RightItalic', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([
            ['value' => 'TT', 'style' => 'TableHeader'],
            ['value' => 'Hạng mục công việc', 'style' => 'TableHeader'],
            ['value' => 'Đơn vị tính', 'style' => 'TableHeader'],
            ['value' => 'Số lượng', 'style' => 'TableHeader'],
            ['value' => 'Đơn giá', 'style' => 'TableHeader'],
            ['value' => 'Thành tiền', 'style' => 'TableHeader'],
            ['value' => 'Ghi chú', 'style' => 'TableHeader'],
        ]);

        foreach ($quotation['items'] as $index => $item) {
            $rows[] = $this->buildExcelRow([
                ['value' => $index + 1, 'style' => 'TableCellCenter', 'type' => 'Number'],
                ['value' => $item['product_name'], 'style' => 'TableCellText'],
                ['value' => $item['unit'] ?: '—', 'style' => 'TableCellCenter'],
                ['value' => $this->formatQuantity($item['quantity']), 'style' => 'TableCellCenter'],
                ['value' => $this->formatMoney($item['unit_price']), 'style' => 'TableCellNumber'],
                ['value' => $this->formatMoney($item['line_total']), 'style' => 'TableCellNumber'],
                ['value' => $item['note'], 'style' => 'TableCellText'],
            ]);
        }

        $rows[] = $this->buildExcelRow([
            ['value' => 'TỔNG CỘNG TRƯỚC THUẾ', 'style' => 'SummaryLabel', 'mergeAcross' => 4],
            ['value' => $this->formatMoney($quotation['subtotal']), 'style' => 'SummaryValue', 'mergeAcross' => 1],
        ]);
        $rows[] = $this->buildExcelRow([
            ['value' => 'THUẾ GTGT (' . $this->formatRate($quotation['vat_rate']) . '%)', 'style' => 'SummaryLabel', 'mergeAcross' => 4],
            ['value' => $this->formatMoney($quotation['vat_amount']), 'style' => 'SummaryValue', 'mergeAcross' => 1],
        ]);
        $rows[] = $this->buildExcelRow([
            ['value' => 'TỔNG CỘNG SAU THUẾ', 'style' => 'SummaryLabelEmphasis', 'mergeAcross' => 4],
            ['value' => $this->formatMoney($quotation['total']), 'style' => 'SummaryValueEmphasis', 'mergeAcross' => 1],
        ]);
        $rows[] = $this->buildExcelRow([['value' => 'Bằng chữ: ' . $this->capitalizeFirstLetter($quotation['total_in_words']) . '.', 'style' => 'BodyBold', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => '* Ghi chú:', 'style' => 'BodyBold', 'mergeAcross' => 6]]);

        foreach ($quotation['notes'] as $note) {
            $rows[] = $this->buildExcelRow([['value' => '- ' . $note, 'style' => 'Body', 'mergeAcross' => 6]]);
        }

        $rows[] = $this->buildExcelRow([['value' => '* Mọi thông tin trao đổi, vui lòng liên hệ: ' . $quotation['contact_line'], 'style' => 'Body', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([['value' => $quotation['closing_message'], 'style' => 'Body', 'mergeAcross' => 6]]);
        $rows[] = $this->buildExcelRow([]);
        $rows[] = $this->buildExcelRow([
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => $quotation['signatory_title'], 'style' => 'Signature', 'mergeAcross' => 2],
        ]);
        $rows[] = $this->buildExcelRow([
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => $quotation['signatory_unit'], 'style' => 'Signature', 'mergeAcross' => 2],
        ]);
        if (trim((string) $quotation['signatory_name']) !== '') {
            $rows[] = $this->buildExcelRow([
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Signature', 'mergeAcross' => 2],
            ]);
            $rows[] = $this->buildExcelRow([
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => $quotation['signatory_name'], 'style' => 'Signature', 'mergeAcross' => 2],
            ]);
        }

        $columnXml = '';
        foreach (self::EXCEL_COLUMN_WIDTHS as $width) {
            $columnXml .= '<Column ss:AutoFitWidth="0" ss:Width="' . $width * 6 . '"/>';
        }

        return '<?xml version="1.0"?>'
            . '<?mso-application progid="Excel.Sheet"?>'
            . '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
            . ' xmlns:o="urn:schemas-microsoft-com:office:office"'
            . ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
            . ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'
            . ' xmlns:html="http://www.w3.org/TR/REC-html40">'
            . '<Styles>'
            . '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Borders/>'
            . '<Font ss:FontName="Times New Roman" ss:Size="12"/><Interior/><NumberFormat/><Protection/></Style>'
            . '<Style ss:ID="HeaderCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="HeaderCenterBold"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="13"/></Style>'
            . '<Style ss:ID="HeaderCenterItalic"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Italic="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="RightItalic"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Italic="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="Title"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="16"/></Style>'
            . '<Style ss:ID="CenterBold"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="Body"><Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="BodyBold"><Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="TableHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>'
            . '<Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="TableCellCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="TableCellText"><Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="TableCellNumber"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryLabel"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryValue"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryLabelEmphasis"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryValueEmphasis"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="Signature"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '</Styles>'
            . '<Worksheet ss:Name="BaoGia"><Table>' . $columnXml . implode('', $rows) . '</Table></Worksheet>'
            . '</Workbook>';
    }

    private function buildMultiVatExcelWorkbookXml(array $quotation): string
    {
        $rows = [];
        $rows[] = $this->buildExcelRow([['value' => 'VNPT CẦN THƠ', 'style' => 'HeaderCenter', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'TRUNG TÂM KINH DOANH GIẢI PHÁP', 'style' => 'HeaderCenterBold', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'Địa chỉ: 11 Phan Đình Phùng, phường Ninh Kiều, TP. Cần Thơ', 'style' => 'HeaderCenterItalic', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'Điện thoại: 0292 3820888', 'style' => 'HeaderCenterItalic', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([]);
        $rows[] = $this->buildExcelRow([
            ['value' => $quotation['date_display'], 'style' => 'RightItalic', 'mergeAcross' => 7],
        ]);
        $rows[] = $this->buildExcelRow([]);
        $rows[] = $this->buildExcelRow([['value' => 'BÁO GIÁ', 'style' => 'Title', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'Kính gửi: ' . $quotation['recipient_name'], 'style' => 'CenterBold', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'Lời đầu tiên, Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ xin gửi đến Quý đơn vị lời chúc sức khỏe và thành công trong mọi lĩnh vực!', 'style' => 'Body', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'Căn cứ theo nhu cầu của Quý đơn vị, Chúng tôi xin trân trọng gửi đến Quý đơn vị bảng báo giá chi phí các hạng mục công việc ' . $quotation['scope_summary'] . ', cụ thể như sau:', 'style' => 'Body', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => 'ĐVT: đồng', 'style' => 'RightItalic', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([
            ['value' => 'TT', 'style' => 'TableHeader'],
            ['value' => 'Hạng mục công việc', 'style' => 'TableHeader'],
            ['value' => 'Đơn vị tính', 'style' => 'TableHeader'],
            ['value' => 'Số lượng', 'style' => 'TableHeader'],
            ['value' => 'Đơn giá', 'style' => 'TableHeader'],
            ['value' => 'Thuế GTGT', 'style' => 'TableHeader'],
            ['value' => 'Thành tiền (Có VAT)', 'style' => 'TableHeader'],
            ['value' => 'Ghi chú', 'style' => 'TableHeader'],
        ]);

        foreach ($quotation['items'] as $index => $item) {
            $rows[] = $this->buildExcelRow([
                ['value' => $index + 1, 'style' => 'TableCellCenter', 'type' => 'Number'],
                ['value' => $item['product_name'], 'style' => 'TableCellText'],
                ['value' => $item['unit'] ?: '—', 'style' => 'TableCellCenter'],
                ['value' => $this->formatQuantity($item['quantity']), 'style' => 'TableCellCenter'],
                ['value' => $this->formatMoney($item['unit_price']), 'style' => 'TableCellNumber'],
                ['value' => $this->formatMoney($item['vat_amount']), 'style' => 'TableCellNumber'],
                ['value' => $this->formatMoney($item['total_with_vat']), 'style' => 'TableCellNumber'],
                ['value' => implode("\n", $this->buildMultiVatNoteLines($item)), 'style' => 'TableCellText'],
            ]);
        }

        $rows[] = $this->buildExcelRow([
            ['value' => 'TỔNG TIỀN TRƯỚC THUẾ', 'style' => 'SummaryLabel', 'mergeAcross' => 5],
            ['value' => $this->formatMoney($quotation['subtotal']), 'style' => 'SummaryValue'],
            ['value' => '', 'style' => 'SummaryValue'],
        ]);
        $rows[] = $this->buildExcelRow([
            ['value' => 'THUẾ GTGT', 'style' => 'SummaryLabel', 'mergeAcross' => 5],
            ['value' => $this->formatMoney($quotation['vat_amount']), 'style' => 'SummaryValue'],
            ['value' => '', 'style' => 'SummaryValue'],
        ]);
        $rows[] = $this->buildExcelRow([
            ['value' => 'TỔNG CỘNG', 'style' => 'SummaryLabelEmphasis', 'mergeAcross' => 5],
            ['value' => $this->formatMoney($quotation['total']), 'style' => 'SummaryValueEmphasis'],
            ['value' => '', 'style' => 'SummaryValueEmphasis'],
        ]);
        $rows[] = $this->buildExcelRow([['value' => 'Bằng chữ: ' . $this->capitalizeFirstLetter($quotation['total_in_words']) . '.', 'style' => 'BodyBold', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => '* Ghi chú:', 'style' => 'BodyBold', 'mergeAcross' => 7]]);

        foreach ($quotation['notes'] as $note) {
            $rows[] = $this->buildExcelRow([['value' => '- ' . $note, 'style' => 'Body', 'mergeAcross' => 7]]);
        }

        $rows[] = $this->buildExcelRow([['value' => '* Mọi thông tin trao đổi, vui lòng liên hệ: ' . $quotation['contact_line'], 'style' => 'Body', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([['value' => $quotation['closing_message'], 'style' => 'Body', 'mergeAcross' => 7]]);
        $rows[] = $this->buildExcelRow([]);
        $rows[] = $this->buildExcelRow([
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => $quotation['signatory_title'], 'style' => 'Signature', 'mergeAcross' => 2],
        ]);
        $rows[] = $this->buildExcelRow([
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => '', 'style' => 'Body'],
            ['value' => $quotation['signatory_unit'], 'style' => 'Signature', 'mergeAcross' => 2],
        ]);
        if (trim((string) $quotation['signatory_name']) !== '') {
            $rows[] = $this->buildExcelRow([
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Signature', 'mergeAcross' => 2],
            ]);
            $rows[] = $this->buildExcelRow([
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => '', 'style' => 'Body'],
                ['value' => $quotation['signatory_name'], 'style' => 'Signature', 'mergeAcross' => 2],
            ]);
        }

        $columnXml = '';
        foreach (self::MULTI_VAT_EXCEL_COLUMN_WIDTHS as $width) {
            $columnXml .= '<Column ss:AutoFitWidth="0" ss:Width="' . $width * 6 . '"/>';
        }

        return '<?xml version="1.0"?>'
            . '<?mso-application progid="Excel.Sheet"?>'
            . '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
            . ' xmlns:o="urn:schemas-microsoft-com:office:office"'
            . ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
            . ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'
            . ' xmlns:html="http://www.w3.org/TR/REC-html40">'
            . '<Styles>'
            . '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Borders/>'
            . '<Font ss:FontName="Times New Roman" ss:Size="12"/><Interior/><NumberFormat/><Protection/></Style>'
            . '<Style ss:ID="HeaderCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="HeaderCenterBold"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="13"/></Style>'
            . '<Style ss:ID="HeaderCenterItalic"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Italic="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="RightItalic"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Italic="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="Title"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="16"/></Style>'
            . '<Style ss:ID="CenterBold"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="Body"><Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="BodyBold"><Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="TableHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>'
            . '<Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="TableCellCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="TableCellText"><Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="TableCellNumber"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/>'
            . '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryLabel"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryValue"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryLabelEmphasis"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="SummaryValueEmphasis"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '<Style ss:ID="Signature"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="12"/></Style>'
            . '</Styles>'
            . '<Worksheet ss:Name="BaoGia"><Table>' . $columnXml . implode('', $rows) . '</Table></Worksheet>'
            . '</Workbook>';
    }

    /**
     * @param array<int, array{value?: mixed, style?: string, mergeAcross?: int, type?: string}> $cells
     */
    private function buildExcelRow(array $cells): string
    {
        if ($cells === []) {
            return '<Row/>';
        }

        $cellXml = '';
        foreach ($cells as $cell) {
            $style = $cell['style'] ?? 'Default';
            $value = $cell['value'] ?? '';
            $type = $cell['type'] ?? (is_numeric($value) && !is_string($value) ? 'Number' : 'String');
            $mergeAcross = isset($cell['mergeAcross']) && (int) $cell['mergeAcross'] > 0
                ? ' ss:MergeAcross="' . (int) $cell['mergeAcross'] . '"'
                : '';
            $cellXml .= '<Cell ss:StyleID="' . $style . '"' . $mergeAcross . '><Data ss:Type="' . $type . '">'
                . $this->escapeXml((string) $value)
                . '</Data></Cell>';
        }

        return '<Row>' . $cellXml . '</Row>';
    }

    private function buildQuotationExportFilename(string $recipientName, Carbon $date, string $extension): string
    {
        $normalizedRecipient = trim(preg_replace('/\s+/u', ' ', $recipientName) ?? $recipientName);
        $normalizedRecipient = preg_replace('/[\\\\\\/:*?"<>|]+/u', ' ', $normalizedRecipient) ?? $normalizedRecipient;
        $normalizedRecipient = trim(preg_replace('/\s+/u', ' ', $normalizedRecipient) ?? $normalizedRecipient);

        if ($normalizedRecipient === '') {
            $normalizedRecipient = 'Khách hàng';
        }

        $filename = sprintf(
            'Báo giá %s %s',
            $normalizedRecipient,
            $date->format('Y m d')
        );

        return $filename . '.' . ltrim($extension, '.');
    }

    private function printPreviewHtmlToPdf(
        string $chromeBinary,
        string $previewHtmlPath,
        string $pdfPath,
        string $workingDirectory
    ): void {
        $targetUrl = 'file://' . $previewHtmlPath;
        $baseArguments = [
            '--disable-gpu',
            '--allow-file-access-from-files',
            '--no-first-run',
            '--no-default-browser-check',
            '--no-pdf-header-footer',
            '--print-to-pdf=' . $pdfPath,
            $targetUrl,
        ];

        $lastException = null;

        foreach (['--headless=new', '--headless'] as $headlessMode) {
            try {
                $this->runExternalProcess(
                    new Process(array_merge([$chromeBinary, $headlessMode], $baseArguments), $workingDirectory, null, null, 90),
                    'Không thể in Quick Look preview ra PDF.'
                );

                if (is_file($pdfPath) && filesize($pdfPath) > 0) {
                    return;
                }

                throw new RuntimeException('Chrome không tạo ra file PDF hợp lệ.');
            } catch (Throwable $exception) {
                $lastException = $exception;
                @unlink($pdfPath);
            }
        }

        throw new RuntimeException('Không thể convert Quick Look preview sang PDF.', 0, $lastException);
    }

    /**
     * @param array<int, string> $commandNames
     * @param array<int, string> $preferredPaths
     */
    private function findExecutable(array $commandNames, array $preferredPaths = []): ?string
    {
        foreach ($preferredPaths as $preferredPath) {
            if (is_file($preferredPath) && is_executable($preferredPath)) {
                return $preferredPath;
            }
        }

        $finder = new ExecutableFinder();
        foreach ($commandNames as $commandName) {
            $binary = $finder->find($commandName);
            if (is_string($binary) && $binary !== '') {
                return $binary;
            }
        }

        return null;
    }

    private function createTemporaryDirectory(string $prefix): string
    {
        $basePath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR);
        $directory = $basePath . DIRECTORY_SEPARATOR . $prefix . uniqid('', true);

        if (!mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Không thể tạo thư mục tạm để convert PDF.');
        }

        return $directory;
    }

    private function runExternalProcess(Process $process, string $errorMessage): void
    {
        $process->run();

        if ($process->isSuccessful()) {
            return;
        }

        $detail = trim($process->getErrorOutput() ?: $process->getOutput());
        if ($detail !== '') {
            throw new RuntimeException($errorMessage . ' ' . $detail);
        }

        throw new RuntimeException($errorMessage);
    }

    private function deleteDirectoryRecursively(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $item) {
            $path = $item->getPathname();
            if ($item->isDir()) {
                @rmdir($path);
                continue;
            }

            @unlink($path);
        }

        @rmdir($directory);
    }

    private function buildContentDisposition(string $filename, string $disposition = 'attachment'): string
    {
        $fallback = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename) ?: 'download';

        return $disposition . '; filename="' . $fallback . '"; filename*=UTF-8\'\'' . rawurlencode($filename);
    }

    /**
     * @param array{note: string, vat_rate: float} $item
     * @return array<int, string>
     */
    private function buildMultiVatNoteLines(array $item): array
    {
        $noteLines = $this->splitMultilineText((string) $item['note']);
        $vatLine = 'Thuế ' . $this->formatRate((float) $item['vat_rate']) . '%';

        if (!collect($noteLines)->contains(fn (string $line): bool => mb_strtolower(trim($line)) === mb_strtolower($vatLine))) {
            $noteLines[] = $vatLine;
        }

        return array_values(array_filter($noteLines, fn (string $line): bool => trim($line) !== ''));
    }

    private function toRomanNumeral(int $number): string
    {
        if ($number <= 0) {
            return '';
        }

        $map = [
            1000 => 'M',
            900 => 'CM',
            500 => 'D',
            400 => 'CD',
            100 => 'C',
            90 => 'XC',
            50 => 'L',
            40 => 'XL',
            10 => 'X',
            9 => 'IX',
            5 => 'V',
            4 => 'IV',
            1 => 'I',
        ];

        $result = '';
        foreach ($map as $value => $roman) {
            while ($number >= $value) {
                $result .= $roman;
                $number -= $value;
            }
        }

        return $result;
    }

    /**
     * @return array<int, string>
     */
    private function normalizeNotesText(string $notesText): array
    {
        $lines = preg_split("/\r\n|\r|\n/u", $notesText) ?: [];

        return collect($lines)
            ->map(fn (string $line): string => trim($line))
            ->map(fn (string $line): string => ltrim($line, "-+ \t"))
            ->filter(fn (string $line): bool => $line !== '')
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function splitMultilineText(string $value): array
    {
        $lines = preg_split("/\r\n|\r|\n/u", $value) ?: [];

        return collect($lines)
            ->map(fn (string $line): string => trim($line))
            ->filter(fn (string $line): bool => $line !== '')
            ->values()
            ->all();
    }

    private function normalizeMultilineText(string $value): string
    {
        return preg_replace("/\r\n|\r/u", "\n", trim($value)) ?? '';
    }

    private function formatMoney(float $value): string
    {
        $rounded = round($value, 2);
        $hasFraction = abs($rounded - round($rounded)) > 0.00001;

        return number_format($rounded, $hasFraction ? 2 : 0, ',', '.');
    }

    private function formatQuantity(float $value): string
    {
        $rounded = round($value, 2);
        $hasFraction = abs($rounded - round($rounded)) > 0.00001;

        return number_format($rounded, $hasFraction ? 2 : 0, ',', '.');
    }

    private function formatRate(float $value): string
    {
        $rounded = round($value, 2);
        $hasFraction = abs($rounded - round($rounded)) > 0.00001;

        return number_format($rounded, $hasFraction ? 2 : 0, ',', '.');
    }

    private function escapeXml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function capitalizeFirstLetter(string $value): string
    {
        if ($value === '') {
            return '';
        }

        $first = mb_strtoupper(mb_substr($value, 0, 1));

        return $first . mb_substr($value, 1);
    }

    private function toVietnameseMoneyText(int $value): string
    {
        if ($value <= 0) {
            return 'không đồng';
        }

        $digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
        $scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];

        $groups = [];
        $normalized = (string) $value;
        for ($index = strlen($normalized); $index > 0; $index -= 3) {
            $start = max(0, $index - 3);
            array_unshift($groups, (int) substr($normalized, $start, $index - $start));
        }

        $parts = [];
        foreach ($groups as $index => $groupValue) {
            if ($groupValue === 0) {
                continue;
            }

            $hasNonZeroBefore = collect(array_slice($groups, 0, $index))
                ->contains(fn (int $item): bool => $item > 0);

            $groupText = $this->readVietnameseThreeDigits($groupValue, $hasNonZeroBefore, $digits);
            $scale = $scales[count($groups) - 1 - $index] ?? '';
            $parts[] = trim($groupText . ' ' . $scale);
        }

        $normalizedText = trim(preg_replace('/\s+/u', ' ', implode(' ', $parts)) ?? '');

        return $normalizedText !== '' ? $normalizedText . ' đồng' : 'không đồng';
    }

    /**
     * @param array<int, string> $digits
     */
    private function readVietnameseThreeDigits(int $value, bool $full, array $digits): string
    {
        $hundreds = intdiv($value, 100);
        $tens = intdiv($value % 100, 10);
        $ones = $value % 10;
        $parts = [];

        if ($hundreds > 0 || $full) {
            $parts[] = $digits[$hundreds] . ' trăm';
        }

        if ($tens > 1) {
            $parts[] = $digits[$tens] . ' mươi';
            if ($ones === 1) {
                $parts[] = 'mốt';
            } elseif ($ones === 4) {
                $parts[] = 'tư';
            } elseif ($ones === 5) {
                $parts[] = 'lăm';
            } elseif ($ones > 0) {
                $parts[] = $digits[$ones];
            }

            return trim(implode(' ', $parts));
        }

        if ($tens === 1) {
            $parts[] = 'mười';
            if ($ones === 5) {
                $parts[] = 'lăm';
            } elseif ($ones > 0) {
                $parts[] = $digits[$ones];
            }

            return trim(implode(' ', $parts));
        }

        if ($ones > 0) {
            if ($hundreds > 0 || $full) {
                $parts[] = 'lẻ';
            }
            $parts[] = $digits[$ones];
        }

        return trim(implode(' ', $parts));
    }
}
