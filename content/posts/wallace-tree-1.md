---
title: "Wallace Tree (1)"
date: 2026-01-21
draft: false
type: "posts"
description: "Something About Hardware Multiplier"
math: true
---

为了做 CPU M-Extension 的 Bonus 接触到了 Wallace Tree 乘法器，后来的实现也基本是借鉴的这种乘法。结果 cr 的时候因为周期设计不够 balanced 被 TA 拷打了，之后又在 XiangShan 上找到了一个[基于 Wallace Tree 的乘法器实现](https://github.com/OpenXiangShan/XiangShan/blob/nanhu/src/main/scala/xiangshan/backend/fu/Multiplier.scala)，感觉自己做的那个还是太低级了。

## Before Reading

{{< ncm id="720340" >}}

因为没搞定自动播放，就劳烦手动点一下吧，不过估计撑不到你读完本文（笑）。

## 原理

最简单的二进制乘法可能也没有那么 naive ，大致可以用下面的图来解释:
![简单乘法](https://notes.sjtu.edu.cn/uploads/upload_6104e1fe2ba211fe5e51b6e846fad3e7.jpg)
通过简单的分析可以知道，只需要用 $B$ 的每一位分别与 $A$ 相乘得到 $width$ 个部分积（并左移），之后将它们加起来就可以实现乘法。

得到部分积是很快速的过程，对于第 $i$ 位，只需要将 $B[i]$ 复制 $width$ 位得到 全0 或 全1，之后与 $A$ 做一次 `And` 操作即可。关键的优化在于累加，因为做 32 次 CPA 的耗时是不能忍受的。

Wallace Tree 给出了一个方案：

一个 3-2 压缩器本质上就是一个全加器，接受 3 个数 $a,b,c$ 作为输入，输出 2 个数 $sum$ 和 $carry$。把 $carry$ 左移一位后 $carry+sum=a+b+c$ (这是显然的)。通过这样的一个 3-2 压缩器我们实现了把三个数相加变成两个数相加，全加器的各位之间是独立的（每一位都有 $sum=a \oplus b \oplus c$，$carry=(a \wedge b) \vee (b \wedge c) \vee (a \wedge c)$），避免了 CPA 因需要低位向高位传播信号带来的延迟。

32 个部分积通过一层的压缩可以变成 22 个，继续逐层压缩最终只剩 2 个部分积，做一次 CPA 即可。

## 流水级设计

在我实现的乘法器中对于一次乘法，要做的内容如下:

- 零扩展/符号扩展至 $2*width$ 位宽
- 生成部分积（ $B$ 的每一位并行地与 $A$ 通过 `AND`门）
- 部分积压缩（ 8 层）
- 一次 CPA （用超前进位加法器实现 64 位加法）

注意：部分积压缩的层与层之间是串联的，每一层需要等待上一层的信号，这会导致压缩的总时间远比每层压缩的时间和要大。把 8 层的压缩全部放在一个周期并不是一个很好的选择。

在 M1 中，处理符号位和生成部分积都不会有太多延迟，完全可以进行 2 层压缩。
压缩的另一个好处在于：更少的部分积意味着 M1 到 M2 之间存储这些中间结果的寄存器可以减少。
```python
def cycle_m1(self):
    """
    Execute EX_M1 stage: Partial Product Generation + 2 Levels of Compression

    This stage generates 32 partial products using AND gates, then performs
    Level 1 (32 → 22) and Level 2 (22 → 15) compression.
    """
    # Only process if stage 1 is valid
    with Condition(self.m1_valid[0] == Bits(1)(1)):
        # Read pipeline registers
        op1 = self.m1_op1[0]
        op2 = self.m1_op2[0]
        op1_signed = self.m1_op1_signed[0]
        op2_signed = self.m1_op2_signed[0]

        # =================================================================
        # Step 1: Sign/Zero extend operands to 64 bits
        # =================================================================
        op1_ext = sign_zero_extend(op1, op1_signed)  # 64-bit extended op1

        # =================================================================
        # Step 2: Compute signed multiplication correction for MULH
        # When op2 is signed and negative (op2[31]=1), we need to correct
        # the result because the MSB represents -2^31 instead of +2^31.
        # The correction is: subtract op1 from the high 32 bits of result.
        # =================================================================
        need_correction = op2_signed & op2[31:31]
        signed_correction = need_correction.select(op1, Bits(32)(0))

        # =================================================================
        # Step 3: Generate 32 Partial Products
        # For each bit i of op2: pp[i] = (op2[i] ? op1_ext : 0) << i
        # =================================================================

        # Generate all 32 partial products with correct shifting
        # Note: For a left shift by i bits, we concat zeros on the right

        pp0 = op2[0:0].select(op1_ext, Bits(64)(0))
        pp1 = op2[1:1].select(concat(op1_ext[0:62], Bits(1)(0)), Bits(64)(0))
        pp2 = op2[2:2].select(concat(op1_ext[0:61], Bits(2)(0)), Bits(64)(0))
        pp3 = op2[3:3].select(concat(op1_ext[0:60], Bits(3)(0)), Bits(64)(0))
        pp4 = op2[4:4].select(concat(op1_ext[0:59], Bits(4)(0)), Bits(64)(0))
        pp5 = op2[5:5].select(concat(op1_ext[0:58], Bits(5)(0)), Bits(64)(0))
        pp6 = op2[6:6].select(concat(op1_ext[0:57], Bits(6)(0)), Bits(64)(0))
        pp7 = op2[7:7].select(concat(op1_ext[0:56], Bits(7)(0)), Bits(64)(0))
        pp8 = op2[8:8].select(concat(op1_ext[0:55], Bits(8)(0)), Bits(64)(0))
        pp9 = op2[9:9].select(concat(op1_ext[0:54], Bits(9)(0)), Bits(64)(0))
        pp10 = op2[10:10].select(concat(op1_ext[0:53], Bits(10)(0)), Bits(64)(0))
        pp11 = op2[11:11].select(concat(op1_ext[0:52], Bits(11)(0)), Bits(64)(0))
        pp12 = op2[12:12].select(concat(op1_ext[0:51], Bits(12)(0)), Bits(64)(0))
        pp13 = op2[13:13].select(concat(op1_ext[0:50], Bits(13)(0)), Bits(64)(0))
        pp14 = op2[14:14].select(concat(op1_ext[0:49], Bits(14)(0)), Bits(64)(0))
        pp15 = op2[15:15].select(concat(op1_ext[0:48], Bits(15)(0)), Bits(64)(0))
        pp16 = op2[16:16].select(concat(op1_ext[0:47], Bits(16)(0)), Bits(64)(0))
        pp17 = op2[17:17].select(concat(op1_ext[0:46], Bits(17)(0)), Bits(64)(0))
        pp18 = op2[18:18].select(concat(op1_ext[0:45], Bits(18)(0)), Bits(64)(0))
        pp19 = op2[19:19].select(concat(op1_ext[0:44], Bits(19)(0)), Bits(64)(0))
        pp20 = op2[20:20].select(concat(op1_ext[0:43], Bits(20)(0)), Bits(64)(0))
        pp21 = op2[21:21].select(concat(op1_ext[0:42], Bits(21)(0)), Bits(64)(0))
        pp22 = op2[22:22].select(concat(op1_ext[0:41], Bits(22)(0)), Bits(64)(0))
        pp23 = op2[23:23].select(concat(op1_ext[0:40], Bits(23)(0)), Bits(64)(0))
        pp24 = op2[24:24].select(concat(op1_ext[0:39], Bits(24)(0)), Bits(64)(0))
        pp25 = op2[25:25].select(concat(op1_ext[0:38], Bits(25)(0)), Bits(64)(0))
        pp26 = op2[26:26].select(concat(op1_ext[0:37], Bits(26)(0)), Bits(64)(0))
        pp27 = op2[27:27].select(concat(op1_ext[0:36], Bits(27)(0)), Bits(64)(0))
        pp28 = op2[28:28].select(concat(op1_ext[0:35], Bits(28)(0)), Bits(64)(0))
        pp29 = op2[29:29].select(concat(op1_ext[0:34], Bits(29)(0)), Bits(64)(0))
        pp30 = op2[30:30].select(concat(op1_ext[0:33], Bits(30)(0)), Bits(64)(0))
        pp31 = op2[31:31].select(concat(op1_ext[0:32], Bits(31)(0)), Bits(64)(0))

        # =================================================================
        # Step 4: Wallace Tree Compression Level 1 (32 → 22 rows)
        # =================================================================
        # Level 1: 32 → 22 rows (10 groups of 3, 2 passthrough)
        s1_0, c1_0 = full_adder_64bit(pp0, pp1, pp2)
        s1_1, c1_1 = full_adder_64bit(pp3, pp4, pp5)
        s1_2, c1_2 = full_adder_64bit(pp6, pp7, pp8)
        s1_3, c1_3 = full_adder_64bit(pp9, pp10, pp11)
        s1_4, c1_4 = full_adder_64bit(pp12, pp13, pp14)
        s1_5, c1_5 = full_adder_64bit(pp15, pp16, pp17)
        s1_6, c1_6 = full_adder_64bit(pp18, pp19, pp20)
        s1_7, c1_7 = full_adder_64bit(pp21, pp22, pp23)
        s1_8, c1_8 = full_adder_64bit(pp24, pp25, pp26)
        s1_9, c1_9 = full_adder_64bit(pp27, pp28, pp29)
        # Passthrough: pp30, pp31
        # Level 1 output: 22 rows total (10 sum outputs: s1_0..s1_9, 10 carry outputs: c1_0..c1_9, 2 passthrough: pp30, pp31)

        # =================================================================
        # Step 5: Wallace Tree Compression Level 2 (22 → 15 rows)
        # =================================================================
        # Level 2: 22 → 15 rows (7 groups of 3, 1 passthrough)
        s2_0, c2_0 = full_adder_64bit(s1_0, c1_0, s1_1)
        s2_1, c2_1 = full_adder_64bit(c1_1, s1_2, c1_2)
        s2_2, c2_2 = full_adder_64bit(s1_3, c1_3, s1_4)
        s2_3, c2_3 = full_adder_64bit(c1_4, s1_5, c1_5)
        s2_4, c2_4 = full_adder_64bit(s1_6, c1_6, s1_7)
        s2_5, c2_5 = full_adder_64bit(c1_7, s1_8, c1_8)
        s2_6, c2_6 = full_adder_64bit(s1_9, c1_9, pp30)
        # Passthrough: pp31
        # Level 2 output: 15 rows total (7 sum outputs: s2_0..s2_6, 7 carry outputs: c2_0..c2_6, 1 passthrough: pp31)

        # =================================================================
        # Store 15 intermediate rows in stage 2 pipeline registers
        # =================================================================
        self.m2_valid[0] = Bits(1)(1)
        self.m2_result_high[0] = self.m1_result_high[0]
        self.m2_rd[0] = self.m1_rd[0]
        self.m2_signed_correction[0] = signed_correction

        # Store all 15 intermediate rows
        self.m2_row0[0] = s2_0
        self.m2_row1[0] = c2_0
        self.m2_row2[0] = s2_1
        self.m2_row3[0] = c2_1
        self.m2_row4[0] = s2_2
        self.m2_row5[0] = c2_2
        self.m2_row6[0] = s2_3
        self.m2_row7[0] = c2_3
        self.m2_row8[0] = s2_4
        self.m2_row9[0] = c2_4
        self.m2_row10[0] = s2_5
        self.m2_row11[0] = c2_5
        self.m2_row12[0] = s2_6
        self.m2_row13[0] = c2_6
        self.m2_row14[0] = pp31

        # Clear stage 1
        self.m1_valid[0] = Bits(1)(0)
```

M2 只需要用 `full_adder_64bit` 继续压缩，直到只剩下两个数 $sum$ 和 $carry$ 即可。
```python
def cycle_m2(self):
    """
    Execute EX_M2 stage: Wallace Tree Compression Levels 3-8 (15 → 2 rows)

    This stage continues Wallace Tree compression from 15 rows down to 2 rows.
    """
    # Only process if stage 2 is valid
    with Condition(self.m2_valid[0] == Bits(1)(1)):

        # Read all 15 intermediate rows from pipeline registers
        # From Level 2 output: s2_0..s2_6, c2_0..c2_6, pp31
        s2_0 = self.m2_row0[0]
        c2_0 = self.m2_row1[0]
        s2_1 = self.m2_row2[0]
        c2_1 = self.m2_row3[0]
        s2_2 = self.m2_row4[0]
        c2_2 = self.m2_row5[0]
        s2_3 = self.m2_row6[0]
        c2_3 = self.m2_row7[0]
        s2_4 = self.m2_row8[0]
        c2_4 = self.m2_row9[0]
        s2_5 = self.m2_row10[0]
        c2_5 = self.m2_row11[0]
        s2_6 = self.m2_row12[0]
        c2_6 = self.m2_row13[0]
        pp31 = self.m2_row14[0]

        # =================================================================
        # Wallace Tree Compression Levels 3-8 (15 → 2 rows)
        # =================================================================

        # Level 3: 15 → 10 rows (5 groups of 3)
        s3_0, c3_0 = full_adder_64bit(s2_0, c2_0, s2_1)
        s3_1, c3_1 = full_adder_64bit(c2_1, s2_2, c2_2)
        s3_2, c3_2 = full_adder_64bit(s2_3, c2_3, s2_4)
        s3_3, c3_3 = full_adder_64bit(c2_4, s2_5, c2_5)
        s3_4, c3_4 = full_adder_64bit(s2_6, c2_6, pp31)
        # Level 3 output: 10 rows

        # Level 4: 10 → 7 rows (3 groups of 3, 1 passthrough)
        s4_0, c4_0 = full_adder_64bit(s3_0, c3_0, s3_1)
        s4_1, c4_1 = full_adder_64bit(c3_1, s3_2, c3_2)
        s4_2, c4_2 = full_adder_64bit(s3_3, c3_3, s3_4)
        # Passthrough: c3_4
        # Level 4 output: 7 rows

        # Level 5: 7 → 5 rows (2 groups of 3, 1 passthrough)
        s5_0, c5_0 = full_adder_64bit(s4_0, c4_0, s4_1)
        s5_1, c5_1 = full_adder_64bit(c4_1, s4_2, c4_2)
        # Passthrough: c3_4
        # Level 5 output: 5 rows

        # Level 6: 5 → 4 rows (1 group of 3, 2 passthrough)
        s6_0, c6_0 = full_adder_64bit(s5_0, c5_0, s5_1)
        # Passthrough: c5_1, c3_4
        # Level 6 output: 4 rows

        # Level 7: 4 → 3 rows (1 group of 3, 1 passthrough)
        s7_0, c7_0 = full_adder_64bit(s6_0, c6_0, c5_1)
        # Passthrough: c3_4
        # Level 7 output: 3 rows

        # Level 8: 3 → 2 rows (final Wallace Tree compression)
        s8_final, c8_final = full_adder_64bit(s7_0, c7_0, c3_4)
        # Final 2 rows: s8_final, c8_final

        # =================================================================
        # Store final 2 rows in stage 3 pipeline registers
        # =================================================================
        self.m3_valid[0] = Bits(1)(1)
        self.m3_result_high[0] = self.m2_result_high[0]
        self.m3_rd[0] = self.m2_rd[0]
        self.m3_signed_correction[0] = self.m2_signed_correction[0]

        # Store the 2 final rows
        self.m3_row0[0] = s8_final
        self.m3_row1[0] = c8_final

        # Clear stage 2
        self.m2_valid[0] = Bits(1)(0)
```


M3 需要注意一个符号修正的问题：$product_{64} = sum + carry + (-correction \ll 32)$
如果正常去做，会多一个减法的延迟（可以单独一个周期的程度），但是上面的写法也表明了我们可以将其视作 3 个数相加，用一次全加器就可以压缩成 2 个数相加。最后只用一次 CLA 获得最终结果。
```python
def cycle_m3(self):
    """
    Execute EX_M3 stage: Final Addition using Carry-Lookahead Adder (CLA)

    This stage completes the multiplication by adding the final 2 rows
    using a carry-lookahead adder, with signed correction integrated via 3:2 compression.
    """
    # Only process if stage 3 is valid and result is not already ready
    with Condition((self.m3_valid[0] == Bits(1)(1)) & (self.m3_result_ready[0] == Bits(1)(0))):

        # Read the 2 final rows from pipeline registers
        s8_final = self.m3_row0[0]
        c8_final = self.m3_row1[0]
        signed_correction = self.m3_signed_correction[0]

        # =================================================================
        # Integrate signed correction using 3:2 compression
        # Instead of computing: product_64 = sum + carry, then high -= correction
        # We compute: product_64 = sum + carry + (-correction << 32)
        #
        # To subtract correction from high 32 bits, we add the two's complement:
        # -correction = ~correction + 1
        # We place this in bits [32:63] and handle the +1 in the carry row
        # =================================================================

        # Create the correction value as a 64-bit number positioned in high 32 bits
        # correction_neg_high represents ~signed_correction in bits [32:63]
        correction_inv = ~signed_correction  # Inverted bits for two's complement
        correction_neg_64 = concat(correction_inv, Bits(32)(0))  # Place in high 32 bits

        # For the +1 of two's complement, we add 1 at bit 32
        # This can be merged into the carry row at position 32
        # Create a 64-bit value with 1 at bit position 32 (i.e., 0x100000000)
        correction_plus_one = Bits(64)(0x100000000)  # 1 << 32

        # Use 3:2 compressor to merge s8_final, c8_final, and correction_neg_64
        s9_0, c9_0 = full_adder_64bit(s8_final, c8_final, correction_neg_64)

        # Use another 3:2 compressor to merge s9_0, c9_0, and correction_plus_one
        s_final, c_final = full_adder_64bit(s9_0, c9_0, correction_plus_one)

        # =================================================================
        # CLA (Carry-Lookahead Adder) - Final Addition
        # Now we have integrated the signed correction into the compression
        # =================================================================
        product_64 = carry_lookahead_adder_64bit(s_final, c_final)

        # Select which 32 bits to return based on operation type
        partial_low = product_64[0:31].bitcast(Bits(32))
        partial_high = product_64[32:63].bitcast(Bits(32))

        result = self.m3_result_high[0].select(
            partial_high,  # High 32 bits for MULH/MULHSU/MULHU
            partial_low  # Low 32 bits for MUL
        )

        # Store final result and mark as ready
        self.m3_result[0] = result
        self.m3_result_ready[0] = Bits(1)(1)
        # Clear valid flag since processing is complete
        self.m3_valid[0] = Bits(1)(0)
```

里面其实还有很多可以优化的地方，但是限于个人目前水平（以及不想为沟槽的 Assassyn 再折腾），大概就到此为止了。下次可能会写一些关于 XiangShan 所实现的乘法器的东西，不过下次的事就下次再说吧（笑）。

## Something Unrelated...

找了一首比较长的，边看帖边听歌很不错的说。

（btw: 花都是真好听啊，怎么改都好听那种！）

之后找个时间把网站的美工搞搞好吧，现在暗色还看的过去，浅色丑的看不下去（）。