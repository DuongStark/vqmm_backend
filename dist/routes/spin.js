"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Các mức giảm giá với xác suất bằng nhau
const DISCOUNTS = [0, 25, 50, 100];
// Map discount → index của ô trên vòng quay (thứ tự trên wheel)
// Wheel segments: 0=0%, 1=25%, 2=50%, 3=100% (mỗi ô 90 độ)
const SEGMENT_COUNT = DISCOUNTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // 90 độ mỗi ô
/**
 * POST /api/spin
 * Body: { sessionId?: string }
 * Response: { sessionId, discount, segmentIndex, totalRotation }
 */
router.post("/spin", async (req, res) => {
    try {
        // Tạo sessionId nếu chưa có (client gửi lên để tracking)
        const sessionId = req.body.sessionId || (0, uuid_1.v4)();
        // Random phía server – đảm bảo xác suất bằng nhau
        const segmentIndex = Math.floor(Math.random() * SEGMENT_COUNT);
        const discount = DISCOUNTS[segmentIndex];
        // Lưu vào DB
        await prisma.spinResult.create({
            data: {
                sessionId,
                discount,
            },
        });
        // Chỉ trả segmentIndex về client – client tự tính góc quay
        // dựa trên góc hiện tại của wheel để luôn dừng đúng ô
        res.json({
            sessionId,
            discount,
            segmentIndex,
        });
    }
    catch (error) {
        console.error("Spin error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * GET /api/results
 * Query: ?page=1&limit=20
 * Response: { results, total, page, limit }
 */
router.get("/results", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [results, total] = await prisma.$transaction([
            prisma.spinResult.findMany({
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.spinResult.count(),
        ]);
        // Thống kê theo discount
        const stats = await prisma.spinResult.groupBy({
            by: ["discount"],
            _count: { discount: true },
            orderBy: { discount: "asc" },
        });
        res.json({
            results,
            total,
            page,
            limit,
            stats: stats.map((s) => ({
                discount: s.discount,
                count: s._count.discount,
            })),
        });
    }
    catch (error) {
        console.error("Results error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=spin.js.map