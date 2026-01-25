---
title: "Wallace Tree (2)"
date: 2026-01-25
draft: false
type: "posts"
description: "Something About Xiangshan Multiplier"
math: true
---

幻影忍者前情提要：[Wallace Tree (1)](https://konpaku-ming.github.io/posts/wallace-tree-1/)

鸽了几天，期间本来想修修网站的美工，可惜摆了。最后只做了一个 Music Player，还因为网页是静态的不好全局播放（笑）。主页放的是我的网易云红心歌单，如果你有跟我相近的审美，I will feel happy😀。

本文主要填一下上次的坑，讲一下 XiangShan 的乘法器。采用的是 nanhu 版的代码，完整代码在[这里](https://github.com/OpenXiangShan/XiangShan/blob/nanhu/src/main/scala/xiangshan/backend/fu/Multiplier.scala)。之后会划分成几个部分细讲一下具体实现。

## Before Reading

{{< ncm id="26131698" >}}

一文一歌也算是惯例了，也是我红心的曲子，歌单太大首页不一定刷得到，就挂在文章里安利了。

Rewrite 是我很喜欢的作品。今天突然发现 [Fall in the Dark](https://music.163.com/#/song?id=26107975) 也是这位歌姬唱的，实际东 gal 共荣（喜）。

## Radix-4 Booth 编码

我们上次讲了最 naive 的二进制乘法，也就是生成部分积，把 32 位乘法变成了 32 次加法。我们注意到，对于二进制乘法 $A\times B$ ，如果 $B$ 的第 $i$ 位是 0，我们可以直接忽略这一位产生的部分积（为 0）。

举个例子，如果乘数 $B=00111110$ ，如果按照 naive 的做法，需要将 5 个部分积相加。但是我们在小学阶段就学过：$114514\times 99=114514\times \left( 100-1 \right) =11451400-114514$ ，这样处理会好算很多。在二进制的例子中，我们可以类似的有：
$$
B=\left( 00111110 \right) _2=2^5+2^4+2^3+2^2+2^1=2^6-2^1=\left( 010000\overline{1}0 \right) _2
$$
其中 $\overline{1}$ 表示 $-1$ 。注意到我们把一串**连续的1**消掉了，这样只会产生两个部分积。

### Radix-2 Booth

上面是很符合人类智慧的优化，我们接着推广。假设乘法 $A\times B$ ，注意到：
$$
A=a_{n-1}a_{n-2}...a_1a_0\left( a_{-1} \right) =a_{n-1}\times \left( -2^{n-1} \right) +a_{n-2}\times 2^{n-2}...+a_0\times 2^0\ \text{（补位的}a_{-1}=0\text{）}
$$
$$
=\left( a_{n-2}-a_{n-1} \right) \times 2^{n-1}+\left( a_{n-3}-a_{n-2} \right) \times 2^{n-2}...+\left( a_0-a_1 \right) \times 2^1+\left( a_{-1}-a_0 \right) \times 2^0
$$

由上式，可以做如下编码：

每次移动 1 位，观察 2 位（当前位 $a_i$ 与低位相邻位 $a_{i-1}$）。

| 当前位 $a_i$ | 右邻位 $a_{i-1}$ | 观察到的模式 | 操作值 | 对被乘数 $B$ 的操作 |
| :---: | :---: | :--- | :---: | :--- |
| **0** | **0** | 连续的 0 | $0$ | 无操作 |
| **0** | **1** | 1 序列结束 | $+1$ | 加上 $B$ |
| **1** | **0** | 1 序列开始 | $-1$ | 减去 $B$ (加补码) |
| **1** | **1** | 连续的 1 | $0$ | 无操作 |

这就是 Radix-2 Booth 编码，每次移动一位，观察两位。

### Radix-4 Booth

如果你的注意力再好一些，会发现：
$$
A=\left( a_{2n+1}a_{2n} \right) a_{2n-1}a_{2n-2}...a_1a_0\left( a_{-1} \right)
$$
（其中 $a_{-1}$ 是补位的0， $a_{2n+1},a_{2n}$ 由符号扩展得到。）

$$
A=a_{2n-1}\times \left( -2^{2n-1} \right) +a_{2n-2}\times 2^{2n-2}...+a_0\times 2^0
$$
$$
=\left( a_{2n-1}+a_{2n}-2a_{2n+1} \right) \times 2^{2n}+\left( a_{2n-3}+a_{2n-2}-2a_{2n-1} \right) \times 2^{2n-2}+
$$
$$
...+\left( a_1+a_2-2a_3 \right) \times 2^2+\left( a_{-1}+a_0-2a_1 \right) \times 2^0
$$
$$
=\sum_{i=0}^n{\left( a_{2i-1}+a_{2i}-2a_{2i+1} \right) \cdot 2^{2i}}
$$

由上式，我们可以一次移动两位，观察三位，做如下编码：

| 3位编码窗口 $(a_{i+1}, a_i, a_{i-1})$ | 代表的操作值 | 对应代码变量 | 硬件实现逻辑 |
| :---: | :---: | :--- | :--- |
| **000** | $0$ | `0.U` | 保持全 0 |
| **001** | $+1$ | `b_sext` | 加被乘数原码 |
| **010** | $+1$ | `b_sext` | 加被乘数原码 |
| **011** | $+2$ | `bx2` | 被乘数左移 1 位 |
| **100** | $-2$ | `neg_bx2` | 被乘数取反左移 1 位 |
| **101** | $-1$ | `neg_b` | 加被乘数补码 |
| **110** | $-1$ | `neg_b` | 加被乘数补码 |
| **111** | $0$ | `0.U` | 保持全 0 |

XiangShan 乘法器通过 Radix-4 Booth 算法生成部分积。它在求补码和拼接部分积的过程中还有一些小巧思，就不详细写了，可以直接看贴在下面的代码：
```
val b_sext, bx2, neg_b, neg_bx2 = Wire(UInt((len+1).W))
b_sext := SignExt(b, len+1)
bx2 := b_sext << 1
neg_b := (~b_sext).asUInt
neg_bx2 := neg_b << 1

val columns: Array[Seq[Bool]] = Array.fill(2*len)(Seq())

var last_x = WireInit(0.U(3.W))
for(i <- Range(0, len, 2)){
  val x = if(i==0) Cat(a(1,0), 0.U(1.W)) else if(i+1==len) SignExt(a(i, i-1), 3) else a(i+1, i-1)
  val pp_temp = MuxLookup(x, 0.U)(Seq(
    1.U -> b_sext,
    2.U -> b_sext,
    3.U -> bx2,
    4.U -> neg_bx2,
    5.U -> neg_b,
    6.U -> neg_b
  ))
  val s = pp_temp(len)
  val t = MuxLookup(last_x, 0.U(2.W))(Seq(
    4.U -> 2.U(2.W),
    5.U -> 1.U(2.W),
    6.U -> 1.U(2.W)
  ))
  last_x = x
  val (pp, weight) = i match {
    case 0 =>
      (Cat(~s, s, s, pp_temp), 0)
    case n if (n==len-1) || (n==len-2) =>
      (Cat(~s, pp_temp, t), i-2)
    case _ =>
      (Cat(1.U(1.W), ~s, pp_temp, t), i-2)
  }
  for(j <- columns.indices){
    if(j >= weight && j < (weight + pp.getWidth)){
      columns(j) = columns(j) :+ pp(j-weight)
    }
  }
}
```
## 列压缩乘法

上一篇文章介绍了 Wallace Tree 的思想，简单来说就是利用全加器将 3 个部分积压缩成 2 个。每层都能实现一次 3:2 的压缩，在 $O(\log N)$ 的层数内就能压缩到只剩 2 个部分积相加。

以 32 位乘法为例。注意到每一个 3:2 压缩，需要一个 64 位压缩器。但其实很多时候低位都是空的，也就是一直做 $+0$ ，会浪费相当一部分的硬件资源。

![部分积](https://notes.sjtu.edu.cn/uploads/upload_8aacfd07ddb32cd21775d15affd24117.jpg)

这是 wikipedia 上摘下来的图，生成的部分积其实就类似这样，更像是一个平行四边形。图中其实是在按行压缩（每三行做一组压缩），但是这样明显浪费了左上角和右下角的计算空白。

如果换个角度看，用全加器做压缩避免了进位传播的延迟，那完全可以把每一列视作的压缩过程抽离出来，不再受“行”的限制。当然每一列在压缩过程中，会接收来自后一列的进位，也会进位给前一列。最终目标是压缩到**每一列**都不超过两个。

### addOneColumn
```
def addOneColumn(col: Seq[Bool], cin: Seq[Bool]): (Seq[Bool], Seq[Bool], Seq[Bool]) = {
  var sum = Seq[Bool]()
  var cout1 = Seq[Bool]()
  var cout2 = Seq[Bool]()
  col.size match {
    case 1 =>  // do nothing
      sum = col ++ cin
    case 2 =>
      val c22 = Module(new C22)
      c22.io.in := col
      sum = c22.io.out(0).asBool +: cin
      cout2 = Seq(c22.io.out(1).asBool)
    case 3 =>
      val c32 = Module(new C32)
      c32.io.in := col
      sum = c32.io.out(0).asBool +: cin
      cout2 = Seq(c32.io.out(1).asBool)
    case 4 =>
      val c53 = Module(new C53)
      for((x, y) <- c53.io.in.take(4) zip col){
        x := y
      }
      c53.io.in.last := (if(cin.nonEmpty) cin.head else 0.U)
      sum = Seq(c53.io.out(0).asBool) ++ (if(cin.nonEmpty) cin.drop(1) else Nil)
      cout1 = Seq(c53.io.out(1).asBool)
      cout2 = Seq(c53.io.out(2).asBool)
    case n =>
      val cin_1 = if(cin.nonEmpty) Seq(cin.head) else Nil
      val cin_2 = if(cin.nonEmpty) cin.drop(1) else Nil
      val (s_1, c_1_1, c_1_2) = addOneColumn(col take 4, cin_1)
      val (s_2, c_2_1, c_2_2) = addOneColumn(col drop 4, cin_2)
      sum = s_1 ++ s_2
      cout1 = c_1_1 ++ c_2_1
      cout2 = c_1_2 ++ c_2_2
  }
  (sum, cout1, cout2)
}
```

`addOneColumn` 的作用是压缩某一列的部分积，具体设计如下：

如果这一列只有 1 位，无需压缩。（加上进位不超过 2 个）
如果有 2 位，使用半加器。（ C22 压缩器，输出 `sum` 留在本列，`carry` 进位）
如果有 3 位，使用全加器。（ C32 压缩器，输出 `sum` 留在本列，`carry` 进位）
如果有 4 位，结合来自低位的 1 个进位，凑成 5 位使用 C53 压缩器。
如果 `addOneColumn` 的这一列还有更多位，将会分组做 `addOneColumn` 。前四位分成一组，后面的所有位作为第二组。

这里简单提一下 C53 的实现，它接受 4 个本列输入和 1 个低位进位，输出 1 个 `sum` 留在本列，和 2 个向高位的进位 `carry_1` `carry_2`。

$sum=x_1\oplus x_2\oplus x_3\oplus x_4\oplus c_{in}$ （一直加，很好理解）

$carry\_1 = \text{Majority}(x_1, x_2, x_3)$ （前三个相加的进位， $\text{Majority}$ 指的是三者中多数决定，也就是 $(x_1 \wedge x_2) \vee (x_2 \wedge x_3) \vee (x_1 \wedge x_3)$ ）

$carry\_2 = \text{Majority}(x_4, c_{in}, (x_1 \oplus x_2 \oplus x_3))$ （前三个的和与 $x_4, c_{in}$ 相加的进位）

### addAll

之后只要检查是否达到压缩完成的条件（每列最多两位），如果某一列没达到，就调用 `addOneColumn` 进行压缩。
```
def addAll(cols: Array[Seq[Bool]], depth: Int): (UInt, UInt) = {
  if(max(cols.map(_.size)) <= 2){
    val sum = Cat(cols.map(_(0)).reverse)
    var k = 0
    while(cols(k).size == 1) k = k+1
    val carry = Cat(cols.drop(k).map(_(1)).reverse)
    (sum, Cat(carry, 0.U(k.W)))
  } else {
    val columns_next = Array.fill(2*len)(Seq[Bool]())
    var cout1, cout2 = Seq[Bool]()
    for( i <- cols.indices){
      val (s, c1, c2) = addOneColumn(cols(i), cout1)
      columns_next(i) = s ++ cout2
      cout1 = c1
      cout2 = c2
    }

    val needReg = depth == 4
    val toNextLayer = if(needReg)
      columns_next.map(_.map(x => RegEnable(x, io.regEnables(1))))
    else
      columns_next

    addAll(toNextLayer, depth+1)
  }
}
```

代码中的 `cout1` `cout2` 是为了照顾到 C53 压缩器，可以同时存两位进位。但是某列在进行压缩时只会用到 `cout1` 作为低位进位 $c_{in}$ ，`cout2` 会直接存到本列并参与下一轮压缩。

深度为 4 时切了一刀，存进寄存器。 XiangShan 中的乘法占两个流水级，等下一个周期继续压缩。

## 写在最后

以上就是 XiangShan 的乘法器，并没有那么难理解，但是很精巧。里面一些很细的优化和小巧思相当值得品味呢。

这篇文章动笔于 1 月 25 日，但是写完已经是 1 月 26 号了。中途出门（被迫）去逛了门口的综合体，意外的有人气。上次来南京还是 25 年的春节，不过当时好像一直在往新街口那块跑（饭局有点多），家门口的反而没去过。再往前，印象就停留在 24 年暑假了，不过那个时候综合体疑似（？）还没开。感叹去上海一年半，南通南京都变得很陌生。不过上海也很陌生，一年半进城恐怕没有 5 次（笑）。

细数了一下，去了两次旦（一次是例会），加上一次幻奏。平均下来半年进一次城，进城还是因为办车万照顾不了偏僻的闵行。

上次出远门好像还是暑假时 Norb 举行的神秘出游。选在了上海最热的天，去了同样是郊区（所以不算进城）的东方绿舟，一群无聊的大学牲在 $35^{\circ}\mathrm{C}$ 的无遮挡空地上走各种桥（公园里很常见那种，各种抽象桥身和造型）。最后热的实在受不了 11 点就去找饭吃了，找了一家很实惠的家常菜来着。最后全员体验市域机场线，幸好没打车回去，我在打车来的一个小时中很坚韧地没有吐出来。

有点恐怖的是刚才为了确认没打错地名打开搜索引擎，发现就在我们去之前一周，东方绿舟还出了事故。难道说那天人那么少也不只是因为天气（？）。

好吧，回忆就止于此，我都忘了是为什么而感慨的了。诸君晚安。